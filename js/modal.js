// Flag info modal: builds the modal DOM per open, wires focus trapping,
// the report-issue panel and outside-click/Escape closing. Split out of
// script.js; see #143.
import { state } from './state.js';
import { getFlagImageDimensions } from './util.js';
import { t } from './i18n.js';
import { getBaseFlagInfoByCode } from './flags.js';
import { createReportForm } from './report.js';

const AMAZON_ASSOCIATE_TAG = 'flagfilter-20';

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function handleModalKeydown(event, modal) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeAnyModal(modal);
        return;
    }

    if (event.key !== 'Tab') {
        return;
    }

    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length === 0) {
        event.preventDefault();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function closeAnyModal(modal) {
    if (typeof modal._closeHandler === 'function') {
        modal._closeHandler();
        return;
    }

    closeModal(modal);
}

export function openModal(modal, initialFocusSelector = '.close-btn') {
    modal._previousFocusElement = document.activeElement;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    const keydownHandler = (event) => handleModalKeydown(event, modal);
    modal._keydownHandler = keydownHandler;
    modal.addEventListener('keydown', keydownHandler);

    const initialFocus = modal.querySelector(initialFocusSelector) || getFocusableElements(modal)[0];
    if (initialFocus) {
        initialFocus.focus();
    }
}

export function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    if (modal._keydownHandler) {
        modal.removeEventListener('keydown', modal._keydownHandler);
        delete modal._keydownHandler;
    }

    if (modal._previousFocusElement && typeof modal._previousFocusElement.focus === 'function') {
        modal._previousFocusElement.focus();
    }
}

// Show flag information modal
export function showFlagInfoModal(flag) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';


    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', t('close'));
    closeBtn.addEventListener('click', () => {
        closeAnyModal(modal);
    });

    // Create flag image
    const flagImage = document.createElement('img');
    // Use a higher-resolution source for the modal — it's displayed up to 400px wide
    // (more on HiDPI screens), so w320 looked soft. The grid keeps w320 for performance;
    // this w640 fetch only happens when a flag is opened (lazy, not the LCP image).
    flagImage.src = flag.url.replace('/w320/', '/w640/');
    flagImage.alt = t('flag_image_alt', { name: flag.name });
    flagImage.className = 'modal-flag-image';

    // Reserve the flag's intrinsic dimensions so the modal does not shift while it loads.
    const flagImageDimensions = getFlagImageDimensions(flag.info.proportion);
    if (flagImageDimensions) {
        flagImage.width = flagImageDimensions.width;
        flagImage.height = flagImageDimensions.height;
    }

    // Create flag information
    const flagInfo = document.createElement('div');
    flagInfo.className = 'flag-info-details';
    flagInfo.id = 'flagModalDescription';

    // Process HTML content to make links clickable
    const processedSymbolism = processHtmlContent(flag.info.symbolism || t('no_information_available'));
    const processedFunfacts = processHtmlContent(flag.info.funfacts || t('no_fun_facts_available'));

    // Amazon affiliate search link — uses the English base name (so the query works
    // in any UI language) with parenthetical aliases stripped. See #126.
    const baseInfo = getBaseFlagInfoByCode(flag.code);
    const englishName = (baseInfo?.name || flag.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const shopUrl = `https://www.amazon.com/s?k=${encodeURIComponent(englishName + ' flag')}&tag=${AMAZON_ASSOCIATE_TAG}`;

    // Add flag information
    flagInfo.innerHTML = `
        <h2 id="flagModalTitle">${flag.name}</h2>
        <p><strong>${t('adopted_label')}:</strong> ${flag.info.adopted || t('unknown')}</p>
        <p><strong>${t('symbolism_label')}:</strong> ${processedSymbolism}</p>
        <p><strong>${t('fun_facts_label')}:</strong> ${processedFunfacts}</p>
        <p><strong>${t('colors_label')}:</strong> ${flag.colors.map((color) => t(`color_${color}`)).join(', ')}</p>
        <div class="modal-actions">
            <a href="${flag.info.wikipedialink}" target="_blank" rel="noopener noreferrer" class="wiki-link">${t('read_more_wikipedia')}</a>
            <a href="${shopUrl}" target="_blank" rel="noopener noreferrer sponsored nofollow" class="shop-link">${t('shop_flag', { name: flag.name })}</a>
            <button class="report-issue-btn" aria-expanded="false" aria-controls="reportFormPanel">${t('report_issue')}</button>
        </div>
        <p class="affiliate-disclosure">${t('amazon_disclosure')}</p>
    `;

    // Create report issue form (initially hidden)
    const { element: reportForm, teardown: teardownReportForm } = createReportForm({
        flag,
        triggerButton: flagInfo.querySelector('.report-issue-btn'),
        onRequestClose: () => closeAnyModal(modal)
    });

    // Assemble modal
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(flagImage);
    modalContent.appendChild(flagInfo);
    modalContent.appendChild(reportForm);
    modal.appendChild(modalContent);
    modal.setAttribute('aria-labelledby', 'flagModalTitle');
    modal.setAttribute('aria-describedby', 'flagModalDescription');

    // Add modal to body
    document.body.appendChild(modal);
    openModal(modal);

    // A modal is built per open and dropped on close; closing it also tears down
    // any Turnstile widget the report form rendered.
    modal._closeHandler = () => {
        teardownReportForm();
        closeDynamicModal(modal);
    };

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAnyModal(modal);
        }
    });

    // Add event listeners to flag links in the modal
    setTimeout(() => {
        document.querySelectorAll('.flag-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const flagCode = link.getAttribute('data-flag-code');
                const linkedFlag = state.flags.find(f => f.code === flagCode);
                if (linkedFlag) {
                    closeDynamicModal(modal);
                    showFlagInfoModal(linkedFlag);
                }
            });
        });
    }, 0);
}

function closeDynamicModal(modal) {
    closeModal(modal);
    modal.remove();
}

// Process HTML content to make links clickable
function processHtmlContent(htmlContent) {
    if (!htmlContent) return '';

    const normalizeForQuery = (value) => value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '+');

    // Parse with DOMParser instead of rewriting the HTML with regex, so links
    // keep working even if flaginfo.json content gains attributes or nested
    // markup. ?q= links are resolved against baseFlagInfo (English source names)
    // so translated UI names do not break them. See #146.
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');

    doc.querySelectorAll('a[href^="?q="]').forEach((link) => {
        const queryValue = link.getAttribute('href').slice('?q='.length);
        const normalizedQuery = normalizeForQuery(queryValue);

        const matchedBaseFlag = state.baseFlagInfo.find((info) =>
            normalizeForQuery(info.name) === normalizedQuery
        );

        if (matchedBaseFlag) {
            link.setAttribute('href', '#');
            link.classList.add('flag-link');
            link.setAttribute('data-flag-code', matchedBaseFlag.shortname);
            return;
        }

        const matchedByCode = state.flags.find((flag) => flag.code.toLowerCase() === queryValue.toLowerCase());
        if (matchedByCode) {
            link.setAttribute('href', '#');
            link.classList.add('flag-link');
            link.setAttribute('data-flag-code', matchedByCode.code);
            return;
        }

        // Unresolvable link: keep the link text, drop the anchor (same as before).
        link.replaceWith(...link.childNodes);
    });

    return doc.body.innerHTML;
}
