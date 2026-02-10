// --- ЗМІННІ ---
let allLessons = [];
let allGroups = []; 
let currentWeek = 1; // Selected week (user can change)
let actualCurrentWeek = 1; // Real current week from backend (for highlighting)
let selectedGroup = '';
let savedGroups = [];

// Variables for smart group search
let allGroupsList = [];
let highlightedIndex = -1;

// Touch tracking for swipe gestures
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// Довідники (завантажуються з Google Таблиці)
let dictionaries = {
    departments: [],
    workshops: []
};

// Load saved groups from localStorage
function loadSavedGroups() {
    const saved = localStorage.getItem('savedGroups');
    if (saved) {
        try {
            savedGroups = JSON.parse(saved);
        } catch (e) {
            savedGroups = [];
        }
    }
    
    // Load last viewed group
    const lastGroup = localStorage.getItem('lastViewedGroup');
    if (lastGroup && savedGroups.includes(lastGroup)) {
        selectedGroup = lastGroup;
    } else if (savedGroups.length > 0) {
        selectedGroup = savedGroups[0];
    } else {
        selectedGroup = localStorage.getItem('student_group') || '';
    }
}

// Save saved groups to localStorage
function saveSavedGroups() {
    localStorage.setItem('savedGroups', JSON.stringify(savedGroups));
}

// Save last viewed group
function saveLastViewedGroup() {
    if (selectedGroup) {
        localStorage.setItem('lastViewedGroup', selectedGroup);
    }
}

// Toggle save group (add/remove from favorites)
function toggleSaveGroup() {
    if (!selectedGroup) return;
    
    const index = savedGroups.indexOf(selectedGroup);
    if (index > -1) {
        // Remove from saved
        savedGroups.splice(index, 1);
    } else {
        // Add to saved
        savedGroups.push(selectedGroup);
    }
    
    saveSavedGroups();
    updateSaveButton();
    updateHeaderDropdown();
}

// Update save button appearance
function updateSaveButton() {
    const btn = document.getElementById('saveGroupBtn');
    const icon = document.getElementById('saveGroupIcon');
    
    if (!btn || !icon) return;
    
    const isSaved = savedGroups.includes(selectedGroup);
    
    if (isSaved) {
        btn.classList.add('saved');
        icon.className = 'fa-solid fa-star';
    } else {
        btn.classList.remove('saved');
        icon.className = 'fa-regular fa-star';
    }
}

// Update header with current group name
function updateHeaderGroupName() {
    const headerName = document.getElementById('headerGroupName');
    const headerChevron = document.getElementById('headerChevron');
    const headerTitle = document.getElementById('headerTitle');
    
    if (!headerName) return;
    
    if (selectedGroup) {
        headerName.textContent = selectedGroup;
        // Show chevron only if there are saved groups
        if (headerChevron) {
            headerChevron.style.display = savedGroups.length > 0 ? 'inline' : 'none';
        }
        // Make clickable only if there are saved groups
        if (headerTitle) {
            if (savedGroups.length > 0) {
                headerTitle.classList.add('clickable');
            } else {
                headerTitle.classList.remove('clickable');
            }
        }
    } else {
        headerName.textContent = 'Розклад';
        if (headerChevron) headerChevron.style.display = 'none';
        if (headerTitle) headerTitle.classList.remove('clickable');
    }
}

// Toggle header dropdown
function toggleHeaderDropdown() {
    const dropdown = document.getElementById('headerDropdown');
    const title = document.getElementById('headerTitle');
    
    if (!dropdown || !title) return;
    
    // Only allow opening if there are saved groups
    if (savedGroups.length === 0) return;
    
    const isOpen = dropdown.classList.toggle('open');
    title.classList.toggle('open', isOpen);
    
    if (isOpen) {
        updateHeaderDropdown();
    }
}

// Update header dropdown content
function updateHeaderDropdown() {
    const dropdown = document.getElementById('headerDropdown');
    if (!dropdown) return;
    
    if (savedGroups.length === 0) {
        dropdown.innerHTML = '<div class="header-dropdown-empty">Немає збережених груп</div>';
        return;
    }
    
    dropdown.innerHTML = savedGroups.map((group, index) => `
        <div class="header-dropdown-item ${group === selectedGroup ? 'active' : ''}" 
             data-group-index="${index}">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>${group}</span>
        </div>
    `).join('');
    
    // Add event listeners to dropdown items
    dropdown.querySelectorAll('.header-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const index = parseInt(item.dataset.groupIndex);
            if (index >= 0 && index < savedGroups.length) {
                selectSavedGroup(savedGroups[index]);
            }
        });
    });
}

// Select a saved group from dropdown
function selectSavedGroup(group) {
    selectedGroup = group;
    saveLastViewedGroup();
    
    // Update search input
    const searchInput = document.getElementById('groupSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = `✓ ${group}`;
    }
    
    // Close dropdown
    const dropdown = document.getElementById('headerDropdown');
    const title = document.getElementById('headerTitle');
    if (dropdown) dropdown.classList.remove('open');
    if (title) title.classList.remove('open');
    
    // Update UI
    updateSaveButton();
    updateHeaderGroupName();
    renderSchedule();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const title = document.getElementById('headerTitle');
    const dropdown = document.getElementById('headerDropdown');
    
    if (title && dropdown && !title.contains(e.target)) {
        dropdown.classList.remove('open');
        title.classList.remove('open');
    }
});

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    
    if (isDark) {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

function updateThemeIcon(isDark) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Load saved groups
    loadSavedGroups();
    
    // Initialize watermark
    updateWeekWatermark();
    
    // Show skeleton immediately
    renderSkeleton();
    
    const cachedData = localStorage.getItem('student_data');
    const cachedGroups = localStorage.getItem('student_all_groups');
    
    if (cachedData) {
        try {
            allLessons = JSON.parse(cachedData);
            if (cachedGroups) allGroups = JSON.parse(cachedGroups);
            else allGroups = extractGroupsFromLessons(allLessons);
            
            populateGroupSelect();
            updateSaveButton();
            updateHeaderGroupName();
            // Don't render yet - keep skeleton until fresh data loads
        } catch(e) { console.error(e); }
    }

    fetchSchedule();
    setInterval(renderSchedule, 60000);
    
    // Initialize swipe gestures
    initSwipeGestures();
});

async function fetchSchedule(force = false) {
    const btn = document.getElementById('refreshBtn');
    const icon = btn.querySelector('i');
    if(icon) icon.classList.add('spin');
    
    // Show skeleton while loading
    if (selectedGroup) {
        renderSkeleton();
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.result === 'success') {
            // Отримуємо групи з data.live.groups (як в student_schedule.html)
            allGroups = data.live.groups || [];
            
            console.log('[STUDENT] Groups loaded:', allGroups.length);
            if (allGroups.length > 0) {
                console.log('[STUDENT] First group:', allGroups[0]);
                // Якщо groups - об'єкти, витягуємо name
                if (typeof allGroups[0] === 'object') {
                    allGroups = allGroups.map(g => g.name || g.code || g);
                    console.log('[STUDENT] Groups converted to strings:', allGroups.length);
                }
            }
            
            // Отримуємо розклад
            allLessons = data.live.lessons || [];
            
            // Якщо групи не прийшли, витягуємо їх з занять
            if (allGroups.length === 0 && allLessons.length > 0) {
                allGroups = extractGroupsFromLessons(allLessons);
            }
            
            // Завантажуємо довідники з data.lists (оптимізовано - в одному запиті)
            if (data.live && data.live.departments && Array.isArray(data.live.departments)) {
                dictionaries.departments = data.live.departments;
                console.log('[DICTIONARIES] Departments loaded:', dictionaries.departments.length);
            }
            if (data.live && data.live.workshops && Array.isArray(data.live.workshops)) {
                dictionaries.workshops = data.live.workshops;
                console.log('[DICTIONARIES] Workshops loaded:', dictionaries.workshops.length);
            }
            
            // Отримуємо поточний тиждень з бекенду
            if (data.currentWeek) {
                currentWeek = data.currentWeek;
                actualCurrentWeek = data.currentWeek; // Save real current week for highlighting
                const isNextWeek = data.isNextWeek || false;
                console.log('[CURRENT WEEK] Loaded from backend:', currentWeek, isNextWeek ? '(next week)' : '(current week)');
                
                // Показуємо панель одразу, не чекаючи setWeek
                updateCurrentWeekIndicator(isNextWeek);
                
                // setWeek викликаємо асинхронно, щоб не блокувати
                setTimeout(() => setWeek(currentWeek), 0);
            }
            
            // Зберігаємо в localStorage
            localStorage.setItem('student_data', JSON.stringify(allLessons));
            localStorage.setItem('student_all_groups', JSON.stringify(allGroups));
            
            populateGroupSelect();
            updateSaveButton();
            updateHeaderGroupName();
            renderSchedule();
        } else {
            throw new Error(data.error || 'Failed to load schedule');
        }

    } catch (error) {
        console.error('Помилка:', error);
        if(force) alert('Помилка з\'єднання: ' + error.message);
    } finally {
        if(icon) icon.classList.remove('spin');
    }
}

function extractGroupsFromLessons(lessons) {
    return [...new Set(lessons.map(l => l.group).filter(g => g))].sort();
}

// Отримати назву кафедри по коду
function getDepartmentName(code) {
    if (!code) return '';
    
    const dept = dictionaries.departments?.find(d => d && d.code === code);
    if (dept && dept.name) {
        return dept.name.trim();
    }
    
    return '';
}

// Отримати код кафедри для практикуму/аудиторії
function getDepartmentCodeForRoom(roomName, lessonDepartmentCode = null) {
    if (!roomName || !dictionaries.workshops) return null;
    
    // Якщо є код кафедри з уроку, спробуємо знайти практикум за ім'ям та кодом кафедри
    if (lessonDepartmentCode) {
        const workshop = dictionaries.workshops.find(w => 
            w && w.name === roomName && w.departmentCode === lessonDepartmentCode
        );
        if (workshop) {
            return workshop.departmentCode;
        }
    }
    
    // Якщо не знайдено за кодом кафедри, шукаємо тільки за ім'ям
    // (може бути випадок, коли код кафедри не вказано в урокі)
    const workshop = dictionaries.workshops.find(w => 
        w && w.name === roomName
    );
    
    return workshop ? workshop.departmentCode : null;
}

function initGroupSearch() {
    const searchInput = document.getElementById('groupSearch');
    const dropdown = document.getElementById('searchDropdown');
    
    // Отримуємо список груп
    if (allGroups && allGroups.length > 0) {
        allGroupsList = [...allGroups].sort();
    }
    
    // При введенні тексту
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        highlightedIndex = -1;
        
        if (query.length < 1) {
            dropdown.classList.remove('open');
            return;
        }
        
        // Фільтруємо групи
        const filtered = allGroupsList.filter(name => 
            name.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="search-dropdown-empty">Не знайдено груп</div>';
            dropdown.classList.add('open');
        } else {
            dropdown.innerHTML = filtered.slice(0, 10).map(name => 
                `<div class="search-dropdown-item" onclick="selectGroup('${name}')">${name}</div>`
            ).join('');
            dropdown.classList.add('open');
        }
    });
    
    // Клавіатурна навігація
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-dropdown-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            updateHighlight(items);
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            items[highlightedIndex].click();
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('open');
        }
    });
    
    // Закриття при кліку поза dropdown
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
    
    // Якщо є збережена група - показуємо
    if (selectedGroup) {
        searchInput.placeholder = `✓ ${selectedGroup}`;
    }
}

function updateHighlight(items) {
    items.forEach((item, index) => {
        item.classList.toggle('highlighted', index === highlightedIndex);
    });
}

function selectGroup(group) {
    selectedGroup = group;
    saveLastViewedGroup();
    
    const searchInput = document.getElementById('groupSearch');
    searchInput.value = '';
    searchInput.placeholder = `✓ ${group}`;
    
    document.getElementById('searchDropdown').classList.remove('open');
    
    updateSaveButton();
    updateHeaderGroupName();
    renderSchedule();
}

function populateGroupSelect() {
    // Ініціалізація розумного пошуку замість select
    initGroupSearch();
    
    // Update header and save button after populating
    updateHeaderGroupName();
    updateSaveButton();
    updateHeaderDropdown();
}

function setWeek(w) {
    currentWeek = w;
    document.getElementById('btnWeek1').className = `week-btn ${w===1 ? 'active' : ''}`;
    document.getElementById('btnWeek2').className = `week-btn ${w===2 ? 'active' : ''}`;
    updateWeekWatermark();
    renderSchedule();
}

// Update week watermark
function updateWeekWatermark() {
    const wm = document.getElementById('weekWatermark');
    if (wm && currentWeek) {
        wm.textContent = currentWeek.toString();
    }
}

// Update current week indicator
function updateCurrentWeekIndicator(isNextWeek = false) {
    const indicator = document.getElementById('currentWeekIndicator');
    const text = document.getElementById('currentWeekText');
    
    if (!indicator || !text) return;
    
    const weekRoman = currentWeek === 1 ? 'I' : 'II';
    
    if (isNextWeek) {
        text.textContent = `Наступний тиждень: ${weekRoman}`;
    } else {
        text.textContent = `Поточний тиждень: ${weekRoman}`;
    }
    
    // Show indicator
    indicator.style.display = 'flex';
}

// Handle swipe gesture
function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Check if it's a vertical scroll (ignore if scrolling)
    if (Math.abs(diffY) > Math.abs(diffX)) {
        return; // User is scrolling vertically, not swiping
    }
    
    // Check threshold (minimum 50px swipe)
    if (Math.abs(diffX) < 50) {
        return; // Swipe too small
    }
    
    // Swipe left (←) → switch to Week 2
    if (diffX < 0 && currentWeek === 1) {
        setWeek(2);
    }
    // Swipe right (→) → switch to Week 1
    else if (diffX > 0 && currentWeek === 2) {
        setWeek(1);
    }
}

// Initialize swipe gesture listeners
function initSwipeGestures() {
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

// Render skeleton loading
function renderSkeleton() {
    const container = document.getElementById('scheduleContainer');
    const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця'];
    
    let skeletonHTML = '';
    
    // Generate 4-5 fake day blocks
    for (let i = 0; i < 4; i++) {
        skeletonHTML += `
            <div class="day-block">
                <div class="day-header">
                    <span class="day-title">${dayNames[i] || 'День'}</span>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-header">
                        <div class="skeleton skeleton-line skeleton-title"></div>
                        <div class="skeleton skeleton-line skeleton-time"></div>
                    </div>
                    <div class="skeleton skeleton-line skeleton-subject"></div>
                    <div class="skeleton skeleton-line skeleton-detail"></div>
                    <div class="skeleton skeleton-line skeleton-detail" style="width: 50%;"></div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-header">
                        <div class="skeleton skeleton-line skeleton-title" style="width: 50%;"></div>
                        <div class="skeleton skeleton-line skeleton-time"></div>
                    </div>
                    <div class="skeleton skeleton-line skeleton-subject" style="width: 70%;"></div>
                    <div class="skeleton skeleton-line skeleton-detail" style="width: 60%;"></div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = skeletonHTML;
}

// --- ЛОГІКА РЕНДЕРИНГУ З ВІКНАМИ ---
function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';

    if (!selectedGroup) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users-viewfinder"></i><p>Оберіть групу</p></div>`;
        return;
    }

    const filtered = allLessons.filter(l => 
        l.group === selectedGroup && 
        (parseInt(l.week) === 0 || parseInt(l.week) === currentWeek)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i><p>Вільний тиждень</p></div>`;
        return;
    }

    const daysOrder = [1, 2, 3, 4, 5, 6, 7];
    
    daysOrder.forEach(dayIndex => {
        // Фільтруємо уроки для конкретного дня
        const dayLessons = filtered.filter(l => parseInt(l.day) === dayIndex).sort((a,b) => a.slot - b.slot);
        
        if (dayLessons.length === 0) return;

        const dayName = DAYS_MAP[dayIndex];
        const daySlots = TIME_SLOTS[dayIndex] || TIME_SLOTS[2];
        
        // Check if this is the current day AND we're showing the actual current week
        const now = new Date();
        let todayDayOfWeek = now.getDay();
        if (todayDayOfWeek === 0) todayDayOfWeek = 7;
        
        // Highlight only if: it's today AND we're viewing the real current week
        const isToday = todayDayOfWeek === parseInt(dayIndex) && currentWeek === actualCurrentWeek;

        const dayBlock = document.createElement('div');
        dayBlock.className = `day-block ${isToday ? 'is-today' : ''}`;
        dayBlock.id = `day-${dayIndex}`;
        dayBlock.innerHTML = `
            <div class="day-header">
                <span class="day-title">${dayName}</span>
            </div>
        `;

        // --- ЛОГІКА ВІКОН ---
        // Знаходимо номер останньої пари на цей день
        const maxSlot = dayLessons.length > 0 
            ? Math.max(...dayLessons.map(l => parseInt(l.slot)))
            : 0;

        // Проходимо по всіх парах від 1 до останньої
        for (let slot = 1; slot <= maxSlot; slot++) {
            const lessonsInSlot = dayLessons.filter(l => parseInt(l.slot) === slot);
            const slotInfo = daySlots.find(s => s.num === slot) || { time: '??:??', start: 0, end: 0 };
            const status = getLessonTimeStatus(dayIndex, slotInfo.start, slotInfo.end);

            if (lessonsInSlot.length > 0) {
                // РЕНДЕР ПАРИ
                lessonsInSlot.forEach(lesson => {
                    const typeClass = getLessonTypeClass(lesson.type);
                    
                    let statusHtml = '';
                    let progressBarHtml = '';
                    if (status === 'now') {
                        statusHtml = `<div class="status-badge now">Зараз</div>`;
                        
                        // Calculate progress percentage
                        const now = new Date();
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        const percent = Math.max(0, Math.min(100, ((nowMinutes - slotInfo.start) / (slotInfo.end - slotInfo.start)) * 100));
                        
                        progressBarHtml = `
                            <div class="progress-container">
                                <div class="progress-fill" style="width: ${percent}%"></div>
                            </div>
                        `;
                    } else if (status === 'next') {
                        statusHtml = `<div class="status-badge next">Далі</div>`;
                    }

                    const card = document.createElement('div');
                    card.className = `lesson-card ${typeClass} ${status === 'now' ? 'is-now' : ''}`;
                    card.onclick = () => openModal(lesson, slotInfo.time, dayName);
                    
                    // Додаємо data-атрибути для фільтрації
                    card.dataset.subject = lesson.subject;
                    card.dataset.teacher = lesson.teacher;
                    
                    // Визначаємо чи це практикум і отримуємо назву кафедри
                    // Використовуємо departmentcode з уроку для точного співставлення
                    const lessonDeptCode = lesson.departmentcode || lesson.departmentCode;
                    const roomDeptCode = getDepartmentCodeForRoom(lesson.room, lessonDeptCode);
                    const deptName = roomDeptCode ? getDepartmentName(roomDeptCode) : '';
                    const roomDisplay = lesson.room || 'online';
                    
                    // Екрануємо апострофи для onclick
                    const safeSubject = (lesson.subject || '').replace(/'/g, "\\'");
                    const safeTeacher = (lesson.teacher || '').replace(/'/g, "\\'");
                    
                    card.innerHTML = `
                        ${statusHtml}
                        <div class="l-header">
                            <div class="l-num">${lesson.slot}</div>
                            <div class="l-time">${slotInfo.time}</div>
                        </div>
                        <div class="l-subject" onclick="event.stopPropagation(); activateHighlight('subject', '${safeSubject}', event)">
                            ${lesson.subject}
                            ${lesson.note ? '<i class="fa-solid fa-circle-info note-indicator" title="Є додаткова інформація від викладача"></i>' : ''}
                        </div>
                        <div class="l-footer">
                            <div class="l-details">
                                <div class="l-row clickable" onclick="event.stopPropagation(); activateHighlight('teacher', '${safeTeacher}', event)"><i class="fa-solid fa-user-tie"></i> ${lesson.teacher}</div>
                                <div class="l-row"><i class="fa-solid fa-location-dot"></i> ${roomDisplay}</div>
                                ${deptName ? `<div class="l-row" style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-building" style="opacity:0.5;"></i> Кафедра: ${deptName}</div>` : ''}
                            </div>
                            <div class="type-tag">${lesson.type || ''}</div>
                        </div>
                        ${progressBarHtml}
                    `;
                    dayBlock.appendChild(card);
                });
            } else {
                // РЕНДЕР ВІКНА (вільний час - відсутня пара)
                const windowCard = document.createElement('div');
                windowCard.className = 'window-card';
                
                // Розрахунок статусу вікна (чи зараз йде вікно?)
                // "Вікно" теж може бути "Зараз", якщо студент гуляє
                let windowStatusClass = '';
                if (status === 'now') windowStatusClass = 'background:#f0f9ff; border-color:#3b82f6; opacity:1;';

                windowCard.style.cssText = windowStatusClass;
                windowCard.innerHTML = `
                    <div class="window-info">
                        <i class="fa-solid fa-mug-hot" style="font-size:1.2rem;"></i>
                        <span>Вікно (вільний час)</span>
                    </div>
                    <div class="window-time">${slotInfo.time}</div>
                `;
                dayBlock.appendChild(windowCard);
            }
        }

        container.appendChild(dayBlock);
    });
    
    // Auto-scroll to current day after rendering
    setTimeout(() => {
        scrollToCurrentDay();
    }, 100);
}

// Smart auto-scroll to current day
function scrollToCurrentDay() {
    const now = new Date();
    let currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Convert to our day format: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
    if (currentDay === 0) {
        currentDay = 7; // Sunday
    }
    
    // Try to find the current day element
    let targetElement = document.getElementById(`day-${currentDay}`);
    
    // If not found, search for the nearest next available day
    if (!targetElement) {
        // First, search forward from current day to end of week
        for (let day = currentDay + 1; day <= 7; day++) {
            targetElement = document.getElementById(`day-${day}`);
            if (targetElement) {
                break;
            }
        }
        
        // If still not found, search from beginning of week to current day
        if (!targetElement) {
            for (let day = 1; day < currentDay; day++) {
                targetElement = document.getElementById(`day-${day}`);
                if (targetElement) {
                    break;
                }
            }
        }
    }
    
    // Scroll to the found element
    if (targetElement) {
        targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

function getLessonTimeStatus(dayIndex, startMin, endMin) {
    const now = new Date();
    let currentDay = now.getDay(); 
    if (currentDay === 0) currentDay = 7; 
    
    if (currentDay !== parseInt(dayIndex)) return null;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (nowMinutes >= startMin && nowMinutes <= endMin) return 'now';
    if (startMin > nowMinutes && (startMin - nowMinutes) <= 20) return 'next';
    return null;
}

function getLessonTypeClass(type) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t.includes('лек')) return 'type-lect';
    if (t.includes('прак')) return 'type-prac';
    if (t.includes('лаб')) return 'type-lab';
    if (t.includes('сем')) return 'type-sem';
    return 'type-other';
}

// Convert plain-text URLs to clickable links
function makeLinksClickable(text) {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    
    // Regex to match URLs starting with http:// or https://
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Escape the text first, then replace URLs with clickable links
    const escapedText = escapeHtml(text);
    
    return escapedText.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

function openModal(l, time, dayName) {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <div class="m-row">
            <div class="m-label">Дисципліна</div>
            <div class="m-value" style="font-weight:700;">${l.subject}</div>
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="m-row">
                <div class="m-label">Коли</div>
                <div class="m-value">${dayName}<br>${time}</div>
            </div>
            <div class="m-row">
                <div class="m-label">Тип</div>
                <div class="m-value">${l.type || '-'}</div>
            </div>
        </div>

        <div class="m-row">
            <div class="m-label">Викладач</div>
            <div class="m-value">
                ${l.teacher}
                ${l.teacher2 ? `<br><span style="opacity:0.7">${l.teacher2}</span>` : ''}
            </div>
        </div>

        <div class="m-row">
            <div class="m-label">Аудиторія</div>
            <div class="m-value">
                ${l.room || 'Online'}
                ${l.room2 ? ` / ${l.room2}` : ''}
            </div>
        </div>
        ${(() => {
            const lessonDeptCode = l.departmentcode || l.departmentCode;
            const roomDeptCode = getDepartmentCodeForRoom(l.room, lessonDeptCode);
            const deptName = roomDeptCode ? getDepartmentName(roomDeptCode) : '';
            return deptName ? `
        <div class="m-row">
            <div class="m-label">Кафедра</div>
            <div class="m-value">${deptName}</div>
        </div>` : '';
        })()}

        ${l.note ? `
        <div style="margin-top:10px;">
            <div class="m-label">Примітка</div>
            <div class="note-box">${makeLinksClickable(l.note)}</div>
        </div>` : ''}
    `;
    
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

// ==========================================
// ШВИДКІ ФІЛЬТРИ
// ==========================================

let highlightState = { active: false, type: null, value: null };

function activateHighlight(type, val, e) {
    if (e) e.stopPropagation();
    if (!val) return;
    
    highlightState = { active: true, type, value: val };
    document.body.classList.add('spotlight-active');
    
    const panel = document.getElementById('filter-panel');
    panel.innerHTML = `<span id="filter-msg"><i class="fa-solid fa-filter"></i> ${val}</span><button onclick="clearHighlight()">Скинути (Esc)</button>`;
    panel.classList.add('show');
    
    reapplyHighlight();
}

function reapplyHighlight() {
    document.querySelectorAll('.lesson-card').forEach(card => {
        card.classList.remove('highlighted');
        let match = false;
        
        if (highlightState.type === 'subject' && card.dataset.subject === highlightState.value) {
            match = true;
        }
        if (highlightState.type === 'teacher' && card.dataset.teacher === highlightState.value) {
            match = true;
        }
        
        if (match) {
            card.classList.add('highlighted');
        }
    });
}

function clearHighlight() {
    highlightState = { active: false, type: null, value: null };
    document.body.classList.remove('spotlight-active');
    document.getElementById('filter-panel').classList.remove('show');
    document.querySelectorAll('.lesson-card').forEach(card => {
        card.classList.remove('highlighted');
    });
}

// Обробка Escape для закриття фільтра
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && highlightState.active) {
        clearHighlight();
    }
});
