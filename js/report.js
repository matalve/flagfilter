// The "report an issue" panel inside the flag modal: Turnstile verification,
// submit flow and receipt. Built per modal open; the modal runs the returned
// teardown when it closes. Split out of script.js; see #143.
import { state } from './state.js';
import { focusIfFinePointer, revealInScrollParent } from './util.js';
import { t } from './i18n.js';

// Cloudflare Turnstile bot protection for the report form. The site key is
// public by design; the matching TURNSTILE_SECRET_KEY lives as a secret on the
// Pages project. Until that secret is set the widget renders but the server
// skips verification, so reports keep going through. See #146.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEO8-UkMVW5o0VjW';
const TURNSTILE_TIMEOUT_MS = 30000;
// Cloudflare can ask the reader to tick a box. That runs at their pace, not the
// network's, so the fallback gets a longer budget once the challenge is theirs.
const TURNSTILE_INTERACTION_TIMEOUT_MS = 120000;

function loadTurnstileScript() {
    if (!state.turnstileScriptPromise) {
        state.turnstileScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        // Only success is worth caching. Holding on to a rejected promise would
        // turn one network hiccup into a session where every later report fails
        // verification until the page is reloaded.
        state.turnstileScriptPromise.catch(() => {
            state.turnstileScriptPromise = null;
        });
    }

    return state.turnstileScriptPromise;
}

// Build the report-issue panel for a flag modal. Owns the whole report flow —
// Turnstile verification, submit and the receipt — and returns the panel plus
// a teardown for the modal to run when it closes.
export function createReportForm({ flag, triggerButton, onRequestClose }) {
    // Create report issue form (initially hidden)
    const reportForm = document.createElement('div');
    reportForm.className = 'report-form';
    reportForm.id = 'reportFormPanel';
    reportForm.style.display = 'none';
    reportForm.innerHTML = `
        <h3>${t('report_issue')}</h3>
        <form id="reportForm">
            <input type="hidden" name="flagCode" value="${flag.code}">

            <div class="form-group">
                <label for="issueType">${t('type_of_issue_label')}:</label>
                <select name="issueType" id="issueType" required>
                    <option value="">${t('select_issue_type')}</option>
                    <option value="incorrect_info">${t('issue_incorrect_info')}</option>
                    <option value="missing_info">${t('issue_missing_info')}</option>
                    <option value="broken_link">${t('issue_broken_link')}</option>
                    <option value="other">${t('issue_other')}</option>
                </select>
            </div>

            <div class="form-group">
                <label for="issueDescription">${t('description_label')}:</label>
                <textarea name="issueDescription" id="issueDescription" required
                    maxlength="2000"
                    placeholder="${t('issue_description_placeholder')}"></textarea>
            </div>

            <div class="form-group">
                <label for="userEmail">${t('your_email_optional_label')}:</label>
                <input type="email" name="userEmail" id="userEmail"
                    maxlength="254"
                    placeholder="${t('email_placeholder')}">
            </div>

            ${TURNSTILE_SITE_KEY ? '<div class="turnstile-widget"></div>' : ''}

            <div class="form-actions">
                <button type="submit" class="submit-btn">${t('submit_report')}</button>
                <button type="button" class="cancel-btn">${t('cancel')}</button>
            </div>

        </form>

        <!-- Outside the form: the receipt has to survive the form being hidden
             once a report has been sent. -->
        <div class="report-form-status" role="status" aria-live="polite" hidden></div>

        <div class="form-actions report-form-done" hidden>
            <button type="button" class="close-report-btn">${t('close')}</button>
        </div>
    `;

    // Handle report issue button click
    const reportBtn = triggerButton;
    const form = reportForm.querySelector('#reportForm');
    const cancelBtn = reportForm.querySelector('.cancel-btn');
    const doneActions = reportForm.querySelector('.report-form-done');
    const closeReportBtn = reportForm.querySelector('.close-report-btn');
    const statusMessage = reportForm.querySelector('.report-form-status');
    const submitBtn = reportForm.querySelector('.submit-btn');
    let turnstileWidgetId = null;
    let pendingVerification = null;
    let verificationTimeoutId = null;

    // The challenge runs when the report is submitted, not when the form opens.
    // Running it up front minted a token for every form that was opened and
    // abandoned, and left the widget sitting in the form looking like an
    // unfinished step once a report had been sent. See #146.
    function clearVerificationTimeout() {
        if (verificationTimeoutId !== null) {
            window.clearTimeout(verificationTimeoutId);
            verificationTimeoutId = null;
        }
    }

    // Only ever one timer in flight: restarting replaces the previous one.
    function startVerificationTimeout(delayMs) {
        clearVerificationTimeout();
        verificationTimeoutId = window.setTimeout(() => settleVerification(null, 'turnstile-timeout'), delayMs);
    }

    function settleVerification(token, errorCode) {
        // Drop this attempt's timeout with it. Left running, it would still fire
        // later and settle whatever attempt happened to be pending by then —
        // rejecting a retry that was doing nothing wrong.
        clearVerificationTimeout();

        const pending = pendingVerification;
        pendingVerification = null;

        if (!pending) {
            return;
        }

        if (token) {
            pending.resolve(token);
        } else {
            pending.reject(new Error(errorCode));
        }
    }

    async function renderTurnstileWidget() {
        await loadTurnstileScript();

        if (turnstileWidgetId === null) {
            turnstileWidgetId = window.turnstile.render(reportForm.querySelector('.turnstile-widget'), {
                sitekey: TURNSTILE_SITE_KEY,
                // Wait for turnstile.execute() instead of challenging on render.
                execution: 'execute',
                // Stay out of the layout unless Cloudflare needs the user to act.
                appearance: 'interaction-only',
                callback: (token) => settleVerification(token),
                'before-interactive-callback': () => {
                    showReportStatus('pending', t('report_verify_interaction'));
                    // The wait is now the reader ticking a box, so the short
                    // network-shaped budget would cut them off mid-interaction.
                    startVerificationTimeout(TURNSTILE_INTERACTION_TIMEOUT_MS);
                },
                'error-callback': () => {
                    settleVerification(null, 'turnstile-error');
                    return true;
                },
                'timeout-callback': () => settleVerification(null, 'turnstile-timeout'),
                'expired-callback': () => settleVerification(null, 'turnstile-expired')
            });
        }

        return turnstileWidgetId;
    }

    // Resolves with a fresh token, or '' when Turnstile is not configured. Tokens
    // are single-use, so the widget is reset before every run.
    async function requestTurnstileToken() {
        if (!TURNSTILE_SITE_KEY) {
            return '';
        }

        const widgetId = await renderTurnstileWidget();
        window.turnstile.reset(widgetId);

        return new Promise((resolve, reject) => {
            pendingVerification = { resolve, reject };
            // Belt and braces: Turnstile has its own timeout-callback, but a
            // challenge that never settles would otherwise leave the form
            // disabled with no way out.
            startVerificationTimeout(TURNSTILE_TIMEOUT_MS);
            window.turnstile.execute(widgetId);
        });
    }

    function removeTurnstileWidget() {
        if (turnstileWidgetId !== null && window.turnstile) {
            window.turnstile.remove(turnstileWidgetId);
            turnstileWidgetId = null;
        }
    }

    function clearReportStatus() {
        statusMessage.hidden = true;
        statusMessage.className = 'report-form-status';
        statusMessage.textContent = '';
        statusMessage.replaceChildren();
    }

    function showReportStatus(type, message, githubIssueUrl = '', followUpMessage = '') {
        statusMessage.hidden = false;
        statusMessage.className = `report-form-status ${type}`;
        statusMessage.textContent = '';

        const messageText = document.createElement('div');
        messageText.className = 'report-status-primary';
        messageText.textContent = message;
        statusMessage.appendChild(messageText);

        if (githubIssueUrl && followUpMessage) {
            const followUpLine = document.createElement('div');
            followUpLine.className = 'report-status-secondary';
            followUpLine.textContent = `${followUpMessage} `;

            const issueLink = document.createElement('a');
            issueLink.href = githubIssueUrl;
            issueLink.target = '_blank';
            issueLink.rel = 'noopener noreferrer';
            issueLink.textContent = t('view_github_issue');
            followUpLine.appendChild(issueLink);
            statusMessage.appendChild(followUpLine);
        }

        revealInScrollParent(statusMessage);
    }

    reportBtn.addEventListener('click', () => {
        clearReportStatus();
        reportForm.style.display = 'block';
        reportBtn.style.display = 'none';
        reportBtn.setAttribute('aria-expanded', 'true');
        focusIfFinePointer(form.querySelector('#issueType'));
        // A fine pointer gets this for free from focus(); a touch device does
        // not, and the form opens exactly where the trigger button used to be —
        // at the very bottom of the modal.
        revealInScrollParent(reportForm);
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        // Turnstile injects its own hidden cf-turnstile-response input; the token
        // this request uses is the one minted below, so drop the form copy.
        delete data['cf-turnstile-response'];

        // Verification and sending both take a moment, so the form says what it
        // is doing and stops accepting a second submit while it works.
        submitBtn.disabled = true;
        showReportStatus('pending', t('report_verifying'));

        try {
            try {
                data.turnstileToken = await requestTurnstileToken();
            } catch (error) {
                console.error('Turnstile verification failed:', error);
                showReportStatus('error', t('report_verification_failed'));
                return;
            }

            showReportStatus('pending', t('report_sending'));

            const response = await fetch('/api/report-issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // The report is sent, so Submit and Cancel no longer describe
                // anything the reader can do: swap the whole form for its
                // receipt and a single way out. Hide before showing the status,
                // so it is scrolled into view against the final layout.
                form.reset();
                form.hidden = true;
                doneActions.hidden = false;

                if (result.githubIssueUrl) {
                    showReportStatus('success', t('report_success'), result.githubIssueUrl, t('report_success_with_issue_link'));
                } else {
                    showReportStatus('success', t('report_success'));
                }

                closeReportBtn.focus();
            } else {
                throw new Error(result.error || t('failed_to_submit_report'));
            }
        } catch (error) {
            showReportStatus('error', t('report_error'));
            console.error('Error submitting report:', error);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Cancel means "never mind, I am staying here", so it collapses the panel
    // back to the trigger button with the form ready for a fresh report.
    function collapseReportForm() {
        clearReportStatus();
        form.reset();
        form.hidden = false;
        doneActions.hidden = true;
        reportForm.style.display = 'none';
        reportBtn.style.display = 'inline-flex';
        reportBtn.setAttribute('aria-expanded', 'false');
        reportBtn.focus();
    }

    cancelBtn.addEventListener('click', collapseReportForm);

    // Close means the reader is done: dismiss the whole dialog. Collapsing back
    // to the trigger button looked like nothing had happened, since the modal
    // was already scrolled to the end.
    closeReportBtn.addEventListener('click', onRequestClose);

    return {
        element: reportForm,
        teardown: removeTurnstileWidget
    };
}
