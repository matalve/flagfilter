const ISSUE_TYPE_LABELS = {
    incorrect_info: 'incorrect-info',
    missing_info: 'missing-info',
    broken_link: 'broken-link',
    other: 'other'
};

const FLAG_CODE_PATTERN = /^[a-z]{2}$/;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;
// Deliberately simple: one @ with non-empty local and domain parts.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(payload, status, headers) {
    return new Response(JSON.stringify(payload), { status, headers });
}

// Resolve the flag name server-side from flagCode: the client-supplied flagName
// could diverge from the code or be entirely fabricated. See #146.
async function getFlagNameByCode(context, code) {
    try {
        const flagInfoUrl = new URL('/flaginfo.json', context.request.url);
        const response = context.env.ASSETS
            ? await context.env.ASSETS.fetch(new Request(flagInfoUrl.toString()))
            : await fetch(flagInfoUrl.toString());

        if (!response.ok) {
            return null;
        }

        const flagInfo = await response.json();
        const match = Array.isArray(flagInfo)
            ? flagInfo.find((info) => info && info.shortname === code)
            : null;
        return match && typeof match.name === 'string' ? match.name : null;
    } catch (error) {
        console.error('Could not load flaginfo.json:', error);
        return null;
    }
}

// Cloudflare Turnstile bot protection. Dormant until TURNSTILE_SECRET_KEY is set
// on the Pages project (and the matching site key is configured in script.js);
// without a secret configured, verification is skipped entirely. See #146.
async function verifyTurnstileToken(context, token) {
    if (!context.env.TURNSTILE_SECRET_KEY) {
        return true;
    }

    if (!token) {
        return false;
    }

    try {
        const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: context.env.TURNSTILE_SECRET_KEY,
                response: token
            }).toString()
        });

        if (!result.ok) {
            return false;
        }

        const verification = await result.json();
        return verification.success === true;
    } catch (error) {
        console.error('Turnstile verification failed:', error);
        return false;
    }
}

export async function onRequestPost(context) {
    const jsonHeaders = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    };

    try {
        const hasTelegramConfig = Boolean(context.env.TELEGRAM_BOT_TOKEN && context.env.TELEGRAM_CHAT_ID);
        const hasGitHubConfig = Boolean(
            context.env.GITHUB_TOKEN &&
            context.env.GITHUB_OWNER &&
            context.env.GITHUB_REPO
        );

        if (!hasTelegramConfig && !hasGitHubConfig) {
            return jsonResponse({
                success: false,
                error: 'Issue reporting is not configured on this server.'
            }, 503, jsonHeaders);
        }

        const { flagCode, issueType, issueDescription, userEmail, turnstileToken } = await context.request.json();

        // Input validation
        if (!flagCode || !issueType || !issueDescription) {
            return jsonResponse({
                success: false,
                error: 'Missing required fields'
            }, 400, jsonHeaders);
        }

        const turnstileOk = await verifyTurnstileToken(context, String(turnstileToken || ''));
        if (!turnstileOk) {
            return jsonResponse({
                success: false,
                error: 'Bot verification failed'
            }, 403, jsonHeaders);
        }

        const sanitize = (value) => String(value || '').replace(/[<>]/g, '').trim();
        const sanitizedFlagCode = sanitize(flagCode).toLowerCase();
        const sanitizedIssueType = sanitize(issueType);
        const sanitizedDescription = sanitize(issueDescription);
        const sanitizedEmail = sanitize(userEmail);
        const hasContactEmail = sanitizedEmail !== '';
        const labelPrefix = sanitize(context.env.GITHUB_ISSUE_LABEL_PREFIX || 'flag');
        const configuredLabels = sanitize(context.env.GITHUB_ISSUE_LABELS || 'reported-from-site')
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean);

        if (!FLAG_CODE_PATTERN.test(sanitizedFlagCode)) {
            return jsonResponse({
                success: false,
                error: 'Invalid flag code'
            }, 400, jsonHeaders);
        }

        const flagName = await getFlagNameByCode(context, sanitizedFlagCode);
        if (!flagName) {
            return jsonResponse({
                success: false,
                error: 'Unknown flag code'
            }, 400, jsonHeaders);
        }
        const sanitizedFlagName = sanitize(flagName);

        if (!ISSUE_TYPE_LABELS[sanitizedIssueType]) {
            return jsonResponse({
                success: false,
                error: 'Invalid issue type'
            }, 400, jsonHeaders);
        }

        if (sanitizedDescription === '') {
            return jsonResponse({
                success: false,
                error: 'Missing required fields'
            }, 400, jsonHeaders);
        }

        if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
            return jsonResponse({
                success: false,
                error: 'Description is too long'
            }, 400, jsonHeaders);
        }

        if (hasContactEmail && (sanitizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(sanitizedEmail))) {
            return jsonResponse({
                success: false,
                error: 'Invalid email address'
            }, 400, jsonHeaders);
        }

        const githubLabels = [
            ...configuredLabels,
            ISSUE_TYPE_LABELS[sanitizedIssueType],
            `${labelPrefix}:${sanitizedFlagCode}`
        ];

        const telegramMessage = `
🚩 New Flag Issue Report

Flag: ${sanitizedFlagName} (${sanitizedFlagCode})
Issue Type: ${sanitizedIssueType}
Description: ${sanitizedDescription}
${sanitizedEmail ? `Contact Email: ${sanitizedEmail}` : ''}
        `.trim();

        const githubIssueTitle = `User report - ${sanitizedFlagName} (${sanitizedFlagCode})`;
        const githubIssueBody = [
            '## Report',
            '',
            `- Flag: ${sanitizedFlagName} (${sanitizedFlagCode})`,
            `- Issue type: ${sanitizedIssueType}`,
            `- Contact email provided: ${hasContactEmail ? 'True' : 'False'}`,
            '',
            '## Description',
            '',
            sanitizedDescription
        ].join('\n');

        const failures = [];
        let successCount = 0;
        let githubIssueUrl = null;

        if (hasTelegramConfig) {
            const telegramResponse = await fetch(`https://api.telegram.org/bot${context.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: context.env.TELEGRAM_CHAT_ID,
                    text: telegramMessage
                })
            });

            if (!telegramResponse.ok) {
                failures.push('telegram');
            } else {
                successCount += 1;
            }
        }

        if (hasGitHubConfig) {
            const githubResponse = await fetch(
                `https://api.github.com/repos/${context.env.GITHUB_OWNER}/${context.env.GITHUB_REPO}/issues`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github+json',
                        'Authorization': `Bearer ${context.env.GITHUB_TOKEN}`,
                        'User-Agent': 'flagfilter-reporting'
                    },
                    body: JSON.stringify({
                        title: githubIssueTitle,
                        body: githubIssueBody,
                        labels: githubLabels
                    })
                }
            );

            if (!githubResponse.ok) {
                failures.push('github');
            } else {
                const githubResult = await githubResponse.json();
                githubIssueUrl = githubResult.html_url || null;
                successCount += 1;
            }
        }

        if (successCount === 0) {
            return jsonResponse({
                success: false,
                error: 'Failed to send report'
            }, 502, jsonHeaders);
        }

        return jsonResponse({
            success: true,
            partial: failures.length > 0,
            destinations: {
                telegram: hasTelegramConfig && !failures.includes('telegram'),
                github: hasGitHubConfig && !failures.includes('github')
            },
            githubIssueUrl
        }, 200, jsonHeaders);
    } catch (error) {
        console.error('Error sending report:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to send report'
        }, 500, jsonHeaders);
    }
}
