// Flag info modal: builds the modal DOM per open, wires focus trapping,
// the report-issue panel and outside-click/Escape closing. Split out of
// script.js; see #143.
import { state } from './state.js';
import { getFlagImageDimensions } from './util.js';
import { t } from './translate.js';
import { getBaseFlagInfoByCode } from './flags.js';
import { applyQueryAsFilterState, queryMatchesAnyFilter } from './filters.js';
import { FILTER_GROUPS, flagHasValue } from './filter-config.js';
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
    closeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-xmark"></use></svg>';
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
        <div class="modal-actions">
            <a href="${flag.info.wikipedialink}" target="_blank" rel="noopener noreferrer" class="modal-btn modal-btn--filled wiki-link">${t('read_more_wikipedia')}</a>
            <a href="${shopUrl}" target="_blank" rel="noopener noreferrer sponsored nofollow" class="modal-btn modal-btn--outline shop-link">${t('shop_flag', { name: flag.name })}</a>
        </div>
        <p class="affiliate-disclosure">${t('amazon_disclosure')}</p>
        <div class="modal-utility">
            <button type="button" class="modal-text-btn flag-tags-btn" aria-expanded="false" aria-controls="flagTagsPanel">${t('flag_tags_toggle')}<svg class="icon modal-text-btn-chevron" aria-hidden="true"><use href="#i-chevron-down"></use></svg></button>
            <button type="button" class="modal-text-btn report-issue-btn" aria-expanded="false" aria-controls="reportFormPanel">${t('report_issue')}</button>
        </div>
        ${buildTagsPanel(flag)}
    `;

    const tagsButton = flagInfo.querySelector('.flag-tags-btn');
    const tagsPanel = flagInfo.querySelector('#flagTagsPanel');
    tagsButton.addEventListener('click', () => {
        const expanded = tagsButton.getAttribute('aria-expanded') === 'true';
        tagsButton.setAttribute('aria-expanded', String(!expanded));
        tagsPanel.hidden = expanded;
    });

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

        // Filter links keep their real ?q= href, so they work without JS and can
        // be opened in a new tab. The handler only spares the in-page reader a
        // full page load. See #141. The tags panel's values work the same way (#222).
        modal.querySelectorAll('.filter-link, .flag-tag').forEach((link) => {
            link.addEventListener('click', (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                    return;
                }

                event.preventDefault();
                closeAnyModal(modal);
                applyQueryAsFilterState(link.dataset.query);
            });
        });
    }, 0);
}

// Why a flag turns up for a filter or a search: every filter value it carries,
// grouped and labelled like the filter panel, plus its search-only aliases.
// Collapsed until asked for. Each value keeps a real ?q= href, and the same
// handler as the prose filter links applies it in place.
// This replaced the old "Colors:" line, which showed one group of the same
// list. See #222.
function buildTagsPanel(flag) {
    const groupRows = FILTER_GROUPS.map((group) => {
        const values = group.values.filter((value) => flagHasValue(flag, group, value));
        if (values.length === 0) return '';

        // Colour is a section of its own in the filter panel and has no heading key.
        const label = t(group.heading || 'colors_label');
        const items = values.map((value) => (
            `<li><a href="?q=${encodeURIComponent(value)}" class="flag-tag" data-query="${value}">${t(`${group.key}_${value}`)}</a></li>`
        )).join('');
        return `<dt>${label}</dt><dd><ul class="flag-tag-list">${items}</ul></dd>`;
    }).join('');

    const aliases = flag.info.aliases || [];
    const aliasRow = aliases.length > 0
        ? `<dt>${t('flag_aliases_label')}</dt><dd class="flag-aliases">${aliases.join(', ')}</dd>`
        : '';

    return `
        <div class="flag-tags-panel" id="flagTagsPanel" hidden>
            <dl class="flag-tags">${groupRows}${aliasRow}</dl>
            <p class="flag-tags-hint">${t('flag_tags_hint')}</p>
        </div>
    `;
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

        // Not a flag, but the query names at least one filter — "christianity",
        // "cross", "sun". Those are a way to discover what else is filterable
        // while reading, so the anchor stays and keeps its real ?q= href; only
        // the class and the decoded query are added for the in-page handler.
        // See #141.
        const filterQuery = decodeURIComponent(queryValue.replace(/\+/g, ' '));
        if (queryMatchesAnyFilter(filterQuery)) {
            link.classList.add('filter-link');
            link.dataset.query = filterQuery;
            return;
        }

        // Resolves to nothing: keep the link text, drop the anchor (same as before).
        link.replaceWith(...link.childNodes);
    });

    return doc.body.innerHTML;
}
