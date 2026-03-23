export async function onRequestPost(context) {
    const jsonHeaders = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    };

    const rateLimiter = context.env.REPORT_ISSUE_RATE_LIMITER;
    if (rateLimiter && typeof rateLimiter.limit === 'function') {
        const clientIp = context.request.headers.get('CF-Connecting-IP')
            || context.request.headers.get('X-Forwarded-For')
            || 'anonymous';
        const rateLimitResult = await rateLimiter.limit({ key: `report-issue:${clientIp}` });

        if (!rateLimitResult.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Too many report submissions. Please try again in a minute.'
            }), {
                status: 429,
                headers: {
                    ...jsonHeaders,
                    'Retry-After': '60'
                }
            });
        }
    }

    try {
        const hasTelegramConfig = Boolean(context.env.TELEGRAM_BOT_TOKEN && context.env.TELEGRAM_CHAT_ID);
        const hasGitHubConfig = Boolean(
            context.env.GITHUB_TOKEN &&
            context.env.GITHUB_OWNER &&
            context.env.GITHUB_REPO
        );

        if (!hasTelegramConfig && !hasGitHubConfig) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Issue reporting is not configured on this server.'
            }), {
                status: 503,
                headers: jsonHeaders
            });
        }

        const { flagCode, flagName, issueType, issueDescription, userEmail } = await context.request.json();

        // Input validation
        if (!flagCode || !flagName || !issueType || !issueDescription) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Missing required fields' 
            }), {
                status: 400,
                headers: jsonHeaders
            });
        }

        const sanitize = (value) => String(value || '').replace(/[<>]/g, '').trim();
        const sanitizedFlagCode = sanitize(flagCode);
        const sanitizedFlagName = sanitize(flagName);
        const sanitizedIssueType = sanitize(issueType);
        const sanitizedDescription = sanitize(issueDescription);
        const sanitizedEmail = sanitize(userEmail);
        const hasContactEmail = sanitizedEmail !== '';
        const labelPrefix = sanitize(context.env.GITHUB_ISSUE_LABEL_PREFIX || 'flag');
        const configuredLabels = sanitize(context.env.GITHUB_ISSUE_LABELS || 'reported-from-site')
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean);

        const issueTypeLabels = {
            incorrect_info: 'incorrect-info',
            missing_info: 'missing-info',
            broken_link: 'broken-link',
            other: 'other'
        };

        const githubLabels = [
            ...configuredLabels,
            issueTypeLabels[sanitizedIssueType] || 'other',
            `${labelPrefix}:${sanitizedFlagCode.toLowerCase()}`
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
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to send report'
            }), {
                status: 502,
                headers: jsonHeaders
            });
        }

        return new Response(JSON.stringify({
            success: true,
            partial: failures.length > 0,
            destinations: {
                telegram: hasTelegramConfig && !failures.includes('telegram'),
                github: hasGitHubConfig && !failures.includes('github')
            },
            githubIssueUrl
        }), {
            status: 200,
            headers: jsonHeaders
        });
    } catch (error) {
        console.error('Error sending report:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to send report' 
        }), {
            status: 500,
            headers: jsonHeaders
        });
    }
} 
