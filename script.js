// DOM Elements
const searchInput = document.getElementById('searchInput');
const flagGrid = document.getElementById('flagGrid');
const filterButtons = document.querySelectorAll('.filter-btn');
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

// Global variables
let flags = [];
let filteredFlags = [];
let flagInfo = [];

// Dark mode toggle functionality
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    // Check if user has a saved preference
    const savedDarkMode = localStorage.getItem('darkMode');
    
    // Apply saved preference or use system preference
    if (savedDarkMode !== null) {
        // User has a saved preference
        if (savedDarkMode === 'true') {
            document.body.classList.add('dark-mode');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            document.body.classList.remove('dark-mode');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    } else {
        // No saved preference, check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            // Save this preference
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            // Save this preference
            localStorage.setItem('darkMode', 'false');
        }
    }
    
    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        // Update icons
        if (document.body.classList.contains('dark-mode')) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            // Save preference
            localStorage.setItem('darkMode', 'true');
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            // Save preference
            localStorage.setItem('darkMode', 'false');
        }
    });
}

// Predefined flag colors database
const flagColors = {
    'af': ['black', 'red', 'green'],
    'al': ['red', 'black'],
    'dz': ['green', 'white', 'red'],
    'ad': ['blue', 'yellow', 'red'],
    'ao': ['red', 'black', 'yellow'],
    'ag': ['red', 'blue', 'yellow', 'white', 'black'],
    'ar': ['blue', 'white'],
    'am': ['red', 'blue', 'orange'],
    'au': ['blue', 'red', 'white'],
    'at': ['red', 'white'],
    'az': ['blue', 'red', 'green'],
    'bs': ['blue', 'yellow', 'black'],
    'bh': ['red', 'white'],
    'bd': ['green', 'red'],
    'bb': ['blue', 'yellow', 'black'],
    'by': ['red', 'green', 'white'],
    'be': ['black', 'yellow', 'red'],
    'bz': ['blue', 'red', 'white'],
    'bj': ['green', 'yellow', 'red'],
    'bt': ['yellow', 'orange', 'white'],
    'bo': ['red', 'yellow', 'green'],
    'ba': ['blue', 'yellow', 'white'],
    'bw': ['blue', 'white', 'black'],
    'br': ['green', 'yellow', 'blue', 'white'],
    'bn': ['yellow', 'black', 'white', 'red'],
    'bg': ['white', 'green', 'red'],
    'bf': ['red', 'green', 'yellow'],
    'bi': ['red', 'white', 'green'],
    'kh': ['blue', 'red', 'white'],
    'cm': ['green', 'red', 'yellow', 'white'],
    'ca': ['red', 'white'],
    'cv': ['blue', 'white', 'red', 'yellow'],
    'cf': ['blue', 'white', 'green', 'yellow', 'red'],
    'td': ['blue', 'yellow', 'red'],
    'cl': ['red', 'white', 'blue'],
    'cn': ['red', 'yellow'],
    'co': ['yellow', 'blue', 'red'],
    'km': ['green', 'white', 'red', 'yellow', 'blue'],
    'cg': ['green', 'yellow', 'red'],
    'cd': ['blue', 'yellow', 'red'],
    'cr': ['blue', 'white', 'red'],
    'ci': ['orange', 'white', 'green'],
    'hr': ['red', 'white', 'blue'],
    'cu': ['blue', 'white', 'red'],
    'cy': ['white', 'yellow', 'green'],
    'cz': ['white', 'red', 'blue'],
    'dk': ['red', 'white'],
    'dj': ['blue', 'green', 'white', 'red'],
    'dm': ['green', 'yellow', 'black', 'red', 'white'],
    'do': ['blue', 'red', 'white'],
    'ec': ['yellow', 'blue', 'red'],
    'eg': ['red', 'white', 'black'],
    'sv': ['blue', 'white'],
    'gq': ['green', 'white', 'red', 'blue'],
    'er': ['green', 'red', 'blue', 'yellow'],
    'ee': ['blue', 'black', 'white'],
    'et': ['green', 'yellow', 'red', 'blue'],
    'fj': ['blue', 'red', 'white'],
    'fi': ['white', 'blue'],
    'fr': ['blue', 'white', 'red'],
    'ga': ['green', 'yellow', 'blue'],
    'gm': ['red', 'blue', 'green', 'white'],
    'ge': ['white', 'red'],
    'de': ['black', 'red', 'yellow'],
    'gh': ['red', 'yellow', 'green', 'black'],
    'gr': ['blue', 'white'],
    'gd': ['red', 'yellow', 'green', 'white'],
    'gt': ['blue', 'white'],
    'gn': ['red', 'yellow', 'green'],
    'gw': ['yellow', 'green', 'red', 'black'],
    'gy': ['green', 'white', 'yellow', 'red', 'black'],
    'ht': ['blue', 'red', 'white'],
    'hn': ['blue', 'white'],
    'hu': ['red', 'white', 'green'],
    'is': ['blue', 'white', 'red'],
    'in': ['orange', 'white', 'green'],
    'id': ['red', 'white'],
    'ir': ['green', 'white', 'red'],
    'iq': ['red', 'white', 'black', 'green'],
    'ie': ['green', 'white', 'orange'],
    'il': ['blue', 'white'],
    'it': ['green', 'white', 'red'],
    'jm': ['green', 'yellow', 'black'],
    'jp': ['white', 'red'],
    'jo': ['black', 'white', 'green', 'red'],
    'kz': ['blue', 'yellow'],
    'ke': ['black', 'red', 'green', 'white'],
    'ki': ['red', 'blue', 'white', 'yellow'],
    'kp': ['red', 'white', 'blue'],
    'kr': ['white', 'red', 'blue', 'black'],
    'kw': ['green', 'white', 'red', 'black'],
    'kg': ['red', 'yellow'],
    'la': ['red', 'blue', 'white'],
    'lv': ['red', 'white'],
    'lb': ['red', 'white', 'green'],
    'ls': ['blue', 'white', 'green', 'black'],
    'lr': ['red', 'white', 'blue', 'white'],
    'ly': ['red', 'black', 'green', 'white'],
    'li': ['red', 'blue'],
    'lt': ['yellow', 'green', 'red'],
    'lu': ['red', 'white', 'blue'],
    'mg': ['white', 'red', 'green'],
    'mw': ['black', 'red', 'green'],
    'my': ['red', 'white', 'blue', 'yellow'],
    'mv': ['red', 'green', 'white'],
    'ml': ['green', 'yellow', 'red'],
    'mt': ['white', 'red'],
    'mh': ['blue', 'white', 'orange'],
    'mr': ['green', 'yellow', 'red'],
    'mu': ['red', 'blue', 'yellow', 'green'],
    'mx': ['green', 'white', 'red'],
    'fm': ['blue', 'white'],
    'md': ['blue', 'yellow', 'red'],
    'mc': ['red', 'white'],
    'mn': ['red', 'blue', 'yellow'],
    'me': ['red', 'yellow'],
    'ma': ['red', 'green'],
    'mz': ['green', 'black', 'yellow', 'white', 'red'],
    'mm': ['yellow', 'green', 'red', 'white'],
    'na': ['blue', 'red', 'green', 'white', 'yellow'],
    'nr': ['blue', 'yellow', 'white'],
    'np': ['red', 'blue', 'white'],
    'nl': ['red', 'white', 'blue'],
    'nz': ['blue', 'white', 'red'],
    'ni': ['blue', 'white'],
    'ne': ['orange', 'white', 'green'],
    'ng': ['green', 'white', 'green'],
    'no': ['red', 'white', 'blue'],
    'om': ['red', 'white', 'green'],
    'pk': ['green', 'white'],
    'pw': ['blue', 'yellow'],
    'pa': ['white', 'blue', 'red'],
    'pg': ['red', 'black', 'yellow'],
    'py': ['red', 'white', 'blue'],
    'pe': ['red', 'white'],
    'ph': ['blue', 'red', 'yellow', 'white'],
    'pl': ['white', 'red'],
    'pt': ['red', 'green'],
    'qa': ['white', 'red'],
    'ro': ['blue', 'yellow', 'red'],
    'ru': ['white', 'blue', 'red'],
    'rw': ['blue', 'yellow', 'green'],
    'kn': ['green', 'yellow', 'black', 'red', 'white'],
    'lc': ['blue', 'yellow', 'black', 'white', 'red'],
    'vc': ['blue', 'yellow', 'green', 'white', 'red'],
    'ws': ['red', 'white', 'blue'],
    'sm': ['white', 'blue'],
    'st': ['green', 'yellow', 'red', 'black'],
    'sa': ['green', 'white'],
    'sn': ['green', 'yellow', 'red'],
    'rs': ['red', 'blue', 'white'],
    'sc': ['blue', 'yellow', 'red', 'white', 'green'],
    'sl': ['green', 'white', 'blue'],
    'sg': ['red', 'white'],
    'sk': ['white', 'blue', 'red'],
    'si': ['white', 'blue', 'red'],
    'sb': ['blue', 'yellow', 'green', 'white'],
    'so': ['blue', 'white'],
    'za': ['red', 'blue', 'green', 'yellow', 'white', 'black'],
    'ss': ['black', 'red', 'green', 'blue', 'yellow', 'white'],
    'es': ['red', 'yellow'],
    'lk': ['red', 'green', 'yellow', 'orange'],
    'sd': ['red', 'white', 'black', 'green'],
    'sr': ['green', 'white', 'red', 'yellow'],
    'sz': ['blue', 'yellow', 'red', 'white', 'black'],
    'se': ['blue', 'yellow'],
    'ch': ['red', 'white'],
    'sy': ['red', 'white', 'black', 'green'],
    'tw': ['red', 'blue', 'white'],
    'tj': ['red', 'white', 'green'],
    'tz': ['green', 'yellow', 'blue', 'black'],
    'th': ['red', 'white', 'blue'],
    'tl': ['red', 'yellow', 'black', 'white'],
    'tg': ['green', 'yellow', 'red', 'white'],
    'to': ['red', 'white'],
    'tt': ['red', 'white', 'black'],
    'tn': ['red', 'white'],
    'tr': ['red', 'white'],
    'tm': ['green', 'red', 'white', 'yellow'],
    'tv': ['blue', 'yellow', 'white', 'red'],
    'ug': ['black', 'yellow', 'red'],
    'ua': ['blue', 'yellow'],
    'ae': ['green', 'white', 'black', 'red'],
    'gb': ['blue', 'white', 'red'],
    'us': ['red', 'white', 'blue'],
    'uy': ['white', 'blue', 'yellow'],
    'uz': ['blue', 'white', 'red', 'green'],
    'vu': ['red', 'green', 'yellow', 'black', 'white'],
    'va': ['yellow', 'white'],
    've': ['yellow', 'blue', 'red', 'white'],
    'vn': ['red', 'yellow'],
    'ye': ['red', 'white', 'black'],
    'zm': ['green', 'red', 'black', 'yellow', 'orange'],
    'zw': ['green', 'yellow', 'red', 'black', 'white'],
    'eu': ['blue', 'yellow', 'white']
};

// Continent data structure
const continentData = {
    'africa': ['dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cm', 'cv', 'cf', 'td', 'km', 'cg', 'cd', 'ci', 'dj', 'eg', 'gq', 'er', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'mz', 'na', 'ne', 'ng', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd', 'sz', 'tz', 'tg', 'tn', 'ug', 'zm', 'zw'],
    'asia': ['af', 'am', 'az', 'bh', 'bd', 'bt', 'bn', 'kh', 'cn', 'ge', 'in', 'id', 'ir', 'iq', 'il', 'jp', 'jo', 'kz', 'kw', 'kg', 'la', 'lb', 'my', 'mv', 'mn', 'mm', 'np', 'om', 'pk', 'ph', 'qa', 'sa', 'sg', 'kr', 'lk', 'sy', 'tw', 'tj', 'th', 'tl', 'tr', 'tm', 'ae', 'uz', 'vn', 'ye'],
    'europe': ['al', 'ad', 'at', 'by', 'be', 'ba', 'bg', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'is', 'ie', 'it', 'lv', 'li', 'lt', 'lu', 'mt', 'md', 'mc', 'me', 'nl', 'mk', 'no', 'pl', 'pt', 'ro', 'ru', 'sm', 'rs', 'sk', 'si', 'es', 'se', 'ch', 'ua', 'gb', 'va'],
    'northAmerica': ['ag', 'bs', 'bb', 'bz', 'ca', 'cr', 'cu', 'dm', 'do', 'sv', 'gd', 'gt', 'ht', 'hn', 'jm', 'mx', 'ni', 'pa', 'tt'],
    'southAmerica': ['ar', 'bo', 'br', 'cl', 'co', 'ec', 'gy', 'py', 'pe', 'sr', 'uy', 've'],
    'oceania': ['au', 'fj', 'ki', 'mh', 'nr', 'nz', 'pw', 'pg', 'ws', 'sb', 'to', 'tv', 'vu']
};

// Fetch flag data from Flagpedia API
async function fetchFlags() {
    try {
        // Fetch flag info data
        const flagInfoResponse = await fetch('flaginfo.json');
        flagInfo = await flagInfoResponse.json();
        
        // Create a map of flag info by country code
        const flagInfoMap = {};
        flagInfo.forEach(info => {
            flagInfoMap[info.shortname] = info;
        });
        
        // Process the flag info data directly
        flags = flagInfo.map(info => {
            const code = info.shortname;
            // Use the original flag image URL format
            const url = `https://flagcdn.com/w320/${code}.png`;
            const tags = info.tags || '';
            
            // Extract colors from tags
            const colorTags = ['red', 'blue', 'green', 'yellow', 'white', 'black'];
            const colors = colorTags.filter(color => tags.includes(color));
            
            return {
                code,
                url,
                name: info.name || code.toUpperCase(),
                colors: colors.length > 0 ? colors : extractColorsFromUrl(url),
                tags: tags.split(' '),
                info: info
            };
        });
        
        // Initialize filtered flags
        filteredFlags = [...flags];
        
        // Render the flag grid
        renderFlagGrid();
        
        return flags;
    } catch (error) {
        console.error('Error fetching flag data:', error);
        flagGrid.innerHTML = '<p class="error">Error loading flags. Please try again later.</p>';
    }
}

// Extract colors from flag URL (fallback method)
function extractColorsFromUrl(url) {
    // This is a simplified version of the original function
    // We'll use the tags from flaginfo.json as the primary source
    return [];
}

// Render flag grid
function renderFlagGrid() {
    flagGrid.innerHTML = '';
    
    if (filteredFlags.length === 0) {
        flagGrid.innerHTML = '<p class="no-results">No flags match your search criteria.</p>';
        updateFlagCounter(0);
        return;
    }
    
    filteredFlags.forEach(flag => {
        const flagCard = document.createElement('div');
        flagCard.className = 'flag-card';
        
        flagCard.innerHTML = `
            <img src="${flag.url}" alt="${flag.name} flag" loading="lazy">
            <h3>${flag.name}</h3>
            <button class="learn-more-btn" data-code="${flag.code}">Learn more</button>
        `;
        
        flagGrid.appendChild(flagCard);
    });
    
    updateFlagCounter(filteredFlags.length);
    
    // Add event listeners to all "Learn more" buttons
    document.querySelectorAll('.learn-more-btn').forEach(button => {
        button.addEventListener('click', () => {
            const flagCode = button.getAttribute('data-code');
            const flag = flags.find(f => f.code === flagCode);
            if (flag) {
                showFlagInfoModal(flag);
            }
        });
    });
}

function updateFlagCounter(count) {
    const counter = document.getElementById('flagCounter');
    counter.textContent = `Showing ${count} flag${count !== 1 ? 's' : ''}`;
}

// Show flag information modal
function showFlagInfoModal(flag) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Create close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Create flag image
    const flagImage = document.createElement('img');
    flagImage.src = flag.url;
    flagImage.alt = `${flag.name} flag`;
    flagImage.className = 'modal-flag-image';
    
    // Create flag information
    const flagInfo = document.createElement('div');
    flagInfo.className = 'flag-info-details';
    
    // Process HTML content to make links clickable
    const processedSymbolism = processHtmlContent(flag.info.symbolism || 'No information available.');
    const processedFunfacts = processHtmlContent(flag.info.funfacts || 'No fun facts available.');
    
    // Add flag information
    flagInfo.innerHTML = `
        <h2>${flag.name}</h2>
        <p><strong>Adopted:</strong> ${flag.info.adopted || 'Unknown'}</p>
        <p><strong>Symbolism:</strong> ${processedSymbolism}</p>
        <p><strong>Fun Facts:</strong> ${processedFunfacts}</p>
        <p><strong>Colors:</strong> ${flag.colors.join(', ')}</p>
        <a href="${flag.info.wikipedialink}" target="_blank" class="wiki-link">Read more on Wikipedia</a>
    `;
    
    // Assemble modal
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(flagImage);
    modalContent.appendChild(flagInfo);
    modal.appendChild(modalContent);
    
    // Add modal to body
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Add event listeners to flag links in the modal
    setTimeout(() => {
        document.querySelectorAll('.flag-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const flagCode = link.getAttribute('data-flag-code');
                const linkedFlag = flags.find(f => f.code === flagCode);
                if (linkedFlag) {
                    document.body.removeChild(modal);
                    showFlagInfoModal(linkedFlag);
                }
            });
        });
    }, 0);
}

// Process HTML content to make links clickable
function processHtmlContent(htmlContent) {
    if (!htmlContent) return '';
    
    // Replace links with ?q= parameter to make them open the flag modal
    return htmlContent.replace(/<a href="\?q=([^"]+)">([^<]+)<\/a>/g, (match, flagName, linkText) => {
        // Find the flag by name (case insensitive)
        const flag = flags.find(f => f.name.toLowerCase() === flagName.toLowerCase());
        if (flag) {
            return `<a href="#" class="flag-link" data-flag-code="${flag.code}">${linkText}</a>`;
        }
        return linkText;
    });
}

// Search functionality
function handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (searchTerm === '') {
        // If search is empty, apply only color/continent filters
        applyFilters();
        return;
    }
    
    // Filter flags based on search term
    filteredFlags = flags.filter(flag => 
        flag.name.toLowerCase().includes(searchTerm) || 
        flag.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
    
    // Apply active filters to search results
    applyFilters();
}

// Apply all active filters
function applyFilters() {
    const activeColors = Array.from(document.querySelectorAll('.filter-btn[data-color].active'))
        .map(btn => btn.dataset.color);
    
    const activeContinents = Array.from(document.querySelectorAll('.filter-btn[data-continent].active'))
        .map(btn => btn.dataset.continent);
    
    const activePatterns = Array.from(document.querySelectorAll('.filter-btn[data-pattern].active'))
        .map(btn => btn.dataset.pattern);
    
    const activeSymbols = Array.from(document.querySelectorAll('.filter-btn[data-symbol].active'))
        .map(btn => btn.dataset.symbol);
    
    const activeMotives = Array.from(document.querySelectorAll('.filter-btn[data-motive].active'))
        .map(btn => btn.dataset.motive);
    
    const activePeople = Array.from(document.querySelectorAll('.filter-btn[data-people].active'))
        .map(btn => btn.dataset.people);
    
    const activeIdeologies = Array.from(document.querySelectorAll('.filter-btn[data-ideology].active'))
        .map(btn => btn.dataset.ideology);
    
    const activeTexts = Array.from(document.querySelectorAll('.filter-btn[data-text].active'))
        .map(btn => btn.dataset.text);
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Start with all flags or search results
    let results = searchTerm === '' ? [...flags] : 
        flags.filter(flag => 
            flag.name.toLowerCase().includes(searchTerm) || 
            flag.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    
    // Apply color filters
    if (activeColors.length > 0) {
        results = results.filter(flag => 
            activeColors.every(color => flag.colors.includes(color))
        );
    }
    
    // Apply continent filters
    if (activeContinents.length > 0) {
        results = results.filter(flag => {
            return activeContinents.some(continent => {
                return continentData[continent].includes(flag.code);
            });
        });
    }

    // Apply pattern filters
    if (activePatterns.length > 0) {
        results = results.filter(flag => 
            activePatterns.some(pattern => flag.tags.includes(pattern))
        );
    }

    // Apply symbol filters
    if (activeSymbols.length > 0) {
        results = results.filter(flag => 
            activeSymbols.some(symbol => flag.tags.includes(symbol))
        );
    }

    // Apply motive filters
    if (activeMotives.length > 0) {
        results = results.filter(flag => 
            activeMotives.some(motive => flag.tags.includes(motive))
        );
    }

    // Apply people/clothing filters
    if (activePeople.length > 0) {
        results = results.filter(flag => 
            activePeople.some(people => flag.tags.includes(people))
        );
    }

    // Apply ideology filters
    if (activeIdeologies.length > 0) {
        results = results.filter(flag => 
            activeIdeologies.some(ideology => flag.tags.includes(ideology))
        );
    }

    // Apply text filters
    if (activeTexts.length > 0) {
        results = results.filter(flag => 
            activeTexts.some(text => flag.tags.includes(text))
        );
    }
    
    filteredFlags = results;
    renderFlagGrid();
    updateFilterButtonStates(results);
}

function updateFilterButtonStates(currentResults) {
    // Reset all buttons to enabled state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
    });

    // Check each filter type
    const filterTypes = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];
    
    filterTypes.forEach(type => {
        const buttons = document.querySelectorAll(`.filter-btn[data-${type}]`);
        buttons.forEach(button => {
            const value = button.dataset[type];
            let wouldHaveResults = false;

            // Create a copy of current results to test
            let testResults = [...currentResults];

            // Test if adding this filter would still show results
            if (type === 'color') {
                wouldHaveResults = testResults.some(flag => flag.colors.includes(value));
            } else if (type === 'continent') {
                wouldHaveResults = testResults.some(flag => continentData[value].includes(flag.code));
            } else {
                wouldHaveResults = testResults.some(flag => flag.tags.includes(value));
            }

            // Disable button if it would result in 0 flags
            if (!wouldHaveResults) {
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    });
}

// Color filter functionality
function handleColorFilter(color) {
    if (color) {
        const button = document.querySelector(`[data-color="${color}"]`);
        button.classList.toggle('active');
    }
    
    applyFilters();
}

// Continent filter functionality
function handleContinentFilter(continent) {
    const button = document.querySelector(`[data-continent="${continent}"]`);
    button.classList.toggle('active');
    applyFilters();
}

// Toggle filter section
function toggleFilterSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
    
    // Save the state to localStorage
    const sectionId = section.querySelector('h3').textContent;
    const isCollapsed = section.classList.contains('collapsed');
    localStorage.setItem(`filterSection_${sectionId}`, isCollapsed);
}

// Initialize filter sections from localStorage
function initializeFilterSections() {
    document.querySelectorAll('.filter-section').forEach(section => {
        const sectionId = section.querySelector('h3').textContent;
        const isCollapsed = localStorage.getItem(`filterSection_${sectionId}`) === 'true';
        
        if (isCollapsed || sectionId === 'More filters') {
            section.classList.add('collapsed');
        }
    });
}

// Event Listeners
searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

// Update event listeners for all filter types
document.querySelectorAll('.filter-btn[data-color]').forEach(button => {
    button.addEventListener('click', () => handleColorFilter(button.dataset.color));
});

document.querySelectorAll('.filter-btn[data-continent]').forEach(button => {
    button.addEventListener('click', () => handleContinentFilter(button.dataset.continent));
});

document.querySelectorAll('.filter-btn[data-pattern]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-symbol]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-motive]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-people]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-ideology]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-text]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        applyFilters();
    });
});

// Initialize the app
initDarkMode();
fetchFlags().then(() => {
    initializeFilterSections();
});

// Info modal functionality
const infoButton = document.getElementById('infoButton');
const infoModal = document.getElementById('infoModal');
const closeBtn = infoModal.querySelector('.close-btn');

infoButton.addEventListener('click', () => {
    infoModal.style.display = 'flex';
});

closeBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
        infoModal.style.display = 'none';
    }
}); 