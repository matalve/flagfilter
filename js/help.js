// The help half of the info modal: how search, filters, flag order and links
// work. Built as DOM nodes rather than HTML strings, so translations stay plain
// text. See #41.
import { FILTER_GROUPS } from './filter-config.js';
import { t } from './translate.js';

// Each example is a ?q= that the reader can click. Values come from
// filter-config.js; a Playwright test fails if one stops being a filter.
export const HELP_EXAMPLES = [
    ['star', 'moon'],
    ['red', 'white', 'blue', 'europe'],
    ['bird', 'oceania']
];

const GROUP_KEY_BY_VALUE = new Map(FILTER_GROUPS.flatMap((group) => (
    group.values.map((value) => [value, group.key])
)));

function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

function section(headingKey, ...children) {
    const node = element('section');
    node.append(element('h3', t(headingKey)), ...children);
    return node;
}

// A real ?q= href, so the example also works opened in a new tab. In the page,
// script.js applies it in place, like the filter links in flag prose (#141).
function exampleLink(values) {
    const link = element('a', values.map((value) => t(`${GROUP_KEY_BY_VALUE.get(value)}_${value}`)).join(' + '));
    link.className = 'help-example';
    link.href = `?q=${values.map(encodeURIComponent).join('+')}`;
    link.dataset.query = values.join(' ');
    return link;
}

export function buildHelpContent() {
    const examples = element('ul');
    examples.className = 'help-examples';
    examples.setAttribute('aria-label', t('help_examples_label'));
    HELP_EXAMPLES.forEach((values) => {
        const item = element('li');
        item.append(exampleLink(values));
        examples.append(item);
    });

    const help = element('div');
    help.className = 'help-content';
    help.append(
        section('help_search_heading', element('p', t('help_search_text'))),
        section(
            'help_filter_heading',
            element('p', t('help_filter_text')),
            element('p', t('help_examples_label')),
            examples
        ),
        section('help_order_heading', element('p', t('help_order_text'))),
        section('help_share_heading', element('p', t('help_share_text')))
    );
    return help;
}
