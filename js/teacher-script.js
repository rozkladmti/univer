// CUSTOM ALERT/CONFIRM
// ==========================================

let customAlertResolve = null;

function customAlert(message, title = 'Повідомлення', type = 'info') {
    return new Promise((resolve) => {
        customAlertResolve = resolve;
        
        // Іконки та кольори для різних типів
        const icons = {
            'info': '<i class="fa-solid fa-circle-info" style="color: #3b82f6;"></i>',
            'success': '<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i>',
            'warning': '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i>',
            'error': '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>'
        };
        
        document.getElementById('customAlertIcon').innerHTML = icons[type] || icons['info'];
        document.getElementById('customAlertTitle').textContent = title;
        document.getElementById('customAlertMessage').textContent = message;
        document.getElementById('customAlertActions').innerHTML = '<button class="btn btn-primary" onclick="closeCustomAlert(true)" style="min-width: 100px;">OK</button>';
        document.getElementById('customAlertModal').classList.add('open');
    });
}

function customConfirm(message, title = 'Підтвердження', okText = 'OK', cancelText = 'Скасувати') {
    return new Promise((resolve) => {
        customAlertResolve = resolve;

        // Іконка питання для confirm
        document.getElementById('customAlertIcon').innerHTML = '<i class="fa-solid fa-circle-question" style="color: #f59e0b;"></i>';
        document.getElementById('customAlertTitle').textContent = title;
        document.getElementById('customAlertMessage').textContent = message;
        document.getElementById('customAlertActions').innerHTML = `<button class="btn btn-secondary" onclick="closeCustomAlert(false)" style="min-width: 100px;">${cancelText}</button><button class="btn btn-primary" onclick="closeCustomAlert(true)" style="min-width: 100px;">${okText}</button>`;
        document.getElementById('customAlertModal').classList.add('open');
    });
}

function closeCustomAlert(result) {
    document.getElementById('customAlertModal').classList.remove('open');
    if (customAlertResolve) {
        customAlertResolve(result);
        customAlertResolve = null;
    }
}

// Функція для отримання часу пари за назвою дня і номером слоту
function getTimeSlot(day, slotNum) {
    // Якщо день - це число, конвертуємо його в назву
    const dayName = typeof day === 'number' ? DAYS_MAP[day] : day;
    
    // Знаходимо номер дня тижня (1-7)
    const dayNum = parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === dayName));
    if (!dayNum || !TIME_SLOTS_RAW[dayNum]) {
        console.warn('Cannot find time slot for:', day, dayName, slotNum);
        return { time: "—", start: "—", end: "—", startMin: 0, endMin: 0 };
    }
    
    const slots = TIME_SLOTS_RAW[dayNum];
    const slot = slots.find(s => s.num === slotNum);
    
    if (!slot) {
        console.warn('Cannot find slot:', slotNum, 'for day:', dayName);
        return { time: "—", start: "—", end: "—", startMin: 0, endMin: 0 };
    }
    
    return {
        time: slot.time,
        start: slot.time.split(' - ')[0],
        end: slot.time.split(' - ')[1],
        startMin: slot.start,
        endMin: slot.end
    };
}

// Global state
let allData = null;
// Teacher from URL param takes precedence (for department-generated links)
let selectedTeacher = (function() {
    const urlParams = new URLSearchParams(window.location.search);
    const teacherFromUrl = urlParams.get('teacher');
    if (teacherFromUrl) {
        const decoded = decodeURIComponent(teacherFromUrl);
        localStorage.setItem('selectedTeacher', decoded);
        return decoded;
    }
    return localStorage.getItem('selectedTeacher') || null;
})();
let currentWeek = parseInt(localStorage.getItem('currentWeek')) || 1;
let currentLesson = null;
let selectedVariants = []; // Масив до 3 варіантів
let editingLesson = null; // Пара що редагується

// Touch tracking for swipe gestures
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// Move mode state
let moveMode = {
    active: false,
    lesson: null,
    targetWeek: 1  // Тиждень куди переносимо
};

// ==========================================
// INITIALIZATION
// ==========================================

async function init() {
    // Перевірка що викладач вказаний в URL
    if (!selectedTeacher) {
        document.getElementById('scheduleContainer').innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-slash"></i>
                <p>Викладача не вказано</p>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 8px;">
                    Доступ до додатку здійснюється через посилання з параметром teacher
                </p>
            </div>
        `;
        return;
    }
    
    // Встановлюємо ім'я викладача в header
    document.getElementById('teacherName').textContent = selectedTeacher;
    
    await fetchSchedule();
    initSwipeGestures();
    
    renderSchedule();
    updateRequestsBadge();
    
    // Auto-refresh every 5 minutes
    setInterval(() => fetchSchedule(false), 5 * 60 * 1000);
}

// ==========================================
// DATA FETCHING
// ==========================================

async function fetchSchedule(showSpinner = true) {
    if (showSpinner) {
        document.getElementById('refreshBtn').querySelector('i').classList.add('spin');
    }
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        if (data.result === 'success') {
            allData = data;
            
            // Update current week
            if (data.currentWeek) {
                currentWeek = data.currentWeek;
                localStorage.setItem('currentWeek', data.currentWeek);
                updateWeekButtons();
                updateCurrentWeekIndicator();
            }
            
            // Initialize teacher search
            // Відключено - викладач встановлюється через URL
            
            // Update requests badge
            updateRequestsBadge();
            
            renderSchedule();
        }
    } catch (error) {
        console.error('Error fetching schedule:', error);
        await customAlert('Помилка завантаження даних', 'Помилка', 'error');
    } finally {
        if (showSpinner) {
            document.getElementById('refreshBtn').querySelector('i').classList.remove('spin');
        }
    }
}

// ==========================================
// TEACHERS DROPDOWN
// ==========================================

// ==========================================
// TEACHER SEARCH
// ==========================================

let allTeachers = [];
let highlightedIndex = -1;

function initTeacherSearch() {
    const searchInput = document.getElementById('teacherSearch');
    const dropdown = document.getElementById('searchDropdown');
    
    // Отримуємо список викладачів
    if (allData && allData.live.teachers) {
        // Перевіряємо чи це масив об'єктів чи масив рядків
        if (Array.isArray(allData.live.teachers) && allData.live.teachers.length > 0) {
            if (typeof allData.live.teachers[0] === 'object' && allData.live.teachers[0].name) {
                // Масив об'єктів з полем name
                allTeachers = allData.live.teachers.map(t => t.name).sort();
            } else {
                // Масив рядків
                allTeachers = [...allData.live.teachers].sort();
            }
        }
    }
    
    // При введенні тексту
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        highlightedIndex = -1;
        
        if (query.length < 2) {
            dropdown.classList.remove('open');
            return;
        }
        
        // Фільтруємо викладачів
        const filtered = allTeachers.filter(name => 
            name.toLowerCase().includes(query)
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="search-dropdown-empty">Не знайдено викладачів</div>';
            dropdown.classList.add('open');
        } else {
            dropdown.innerHTML = filtered.slice(0, 10).map(name => 
                `<div class="search-dropdown-item" onclick="selectTeacher('${name}')">${name}</div>`
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
    
    // Якщо є збережений викладач - показуємо
    if (selectedTeacher) {
        searchInput.placeholder = `✓ ${selectedTeacher}`;
    }
}

function updateHighlight(items) {
    items.forEach((item, index) => {
        item.classList.toggle('highlighted', index === highlightedIndex);
    });
}

function selectTeacher(teacher) {
    selectedTeacher = teacher;
    localStorage.setItem('selectedTeacher', teacher);
    
    const searchInput = document.getElementById('teacherSearch');
    searchInput.value = '';
    searchInput.placeholder = `✓ ${teacher}`;
    
    document.getElementById('searchDropdown').classList.remove('open');
    
    renderSchedule();
    updateRequestsBadge();
}

// ==========================================
// WEEK SWITCHING
// ==========================================

function setWeek(week) {
    currentWeek = week;
    localStorage.setItem('currentWeek', week);
    updateWeekButtons();
    updateWeekWatermark();
    renderSchedule();
}

function updateWeekButtons() {
    document.getElementById('btnWeek1').classList.toggle('active', currentWeek === 1);
    document.getElementById('btnWeek2').classList.toggle('active', currentWeek === 2);
    
    if (allData) {
        document.getElementById('btnWeek1').classList.toggle('current', allData.currentWeek === 1);
        document.getElementById('btnWeek2').classList.toggle('current', allData.currentWeek === 2);
    }
}

function updateCurrentWeekIndicator() {
    const indicator = document.getElementById('currentWeekIndicator');
    const text = document.getElementById('currentWeekText');
    
    if (allData && allData.currentWeek) {
        const weekRoman = allData.currentWeek === 1 ? 'I' : 'II';
        const isNextWeek = allData.isNextWeek || false;
        
        if (isNextWeek) {
            text.textContent = `Наступний тиждень: ${weekRoman}`;
        } else {
            text.textContent = `Поточний тиждень: ${weekRoman}`;
        }
        
        indicator.style.display = 'flex';
    }
    
    updateWeekWatermark();
}

// Update week watermark
function updateWeekWatermark() {
    const wm = document.getElementById('weekWatermark');
    if (wm && currentWeek) {
        wm.textContent = currentWeek.toString();
    }
}

// ==========================================
// SWIPE GESTURES
// ==========================================

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

// ==========================================
// TAB SWITCHING
// ==========================================

// ==========================================
// SCHEDULE RENDERING
// ==========================================

// ==========================================
// STATISTICS
// ==========================================

function updateStatistics() {
    if (!selectedTeacher || !allData) {
        return;
    }
    
    const allLessons = allData.live.lessons.filter(l => 
        l.teacher === selectedTeacher || l.teacher2 === selectedTeacher
    );
    
    if (allLessons.length === 0) {
        return;
    }
    
    // Рахуємо пари по тижнях
    const week1Lessons = allLessons.filter(l => l.week === 1);
    const week2Lessons = allLessons.filter(l => l.week === 2);
    
    // Рахуємо унікальні групи
    const uniqueGroups = new Set();
    allLessons.forEach(l => uniqueGroups.add(l.group));
    
    // Рахуємо вікна (для поточного тижня)
    const currentWeekLessons = allLessons.filter(l => l.week === currentWeek);
    let windowsCount = 0;
    
    // Групуємо по днях
    const byDay = {};
    currentWeekLessons.forEach(lesson => {
        const dayName = typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day;
        if (!byDay[dayName]) byDay[dayName] = [];
        byDay[dayName].push(lesson);
    });
    
    // Рахуємо вікна в кожному дні
    Object.keys(byDay).forEach(day => {
        if (day === 'Субота' || day === 'Неділя') return;
        
        const dayLessons = byDay[day].sort((a, b) => a.slot - b.slot);
        if (dayLessons.length === 0) return;
        
        const firstSlot = dayLessons[0].slot;
        const lastSlot = dayLessons[dayLessons.length - 1].slot;
        
        // Вікна між першою і останньою парою
        for (let slot = firstSlot; slot <= lastSlot; slot++) {
            const hasLesson = dayLessons.some(l => l.slot === slot);
            if (!hasLesson) {
                windowsCount++;
            }
        }
    });
    
    // Зберігаємо дані в глобальній змінній
    window.statsData = {
        week1: week1Lessons.length,
        week2: week2Lessons.length,
        groups: uniqueGroups.size,
        windows: windowsCount
    };
}

function openStatsModal() {
    if (!window.statsData) {
        updateStatistics();
    }
    
    if (!window.statsData) {
        customAlert('Немає даних для відображення статистики', 'Інформація', 'info');
        return;
    }
    
    // Оновлюємо значення в модальному вікні
    document.getElementById('modalStatWeek1').textContent = window.statsData.week1;
    document.getElementById('modalStatWeek2').textContent = window.statsData.week2;
    document.getElementById('modalStatGroups').textContent = window.statsData.groups;
    document.getElementById('modalStatWindows').textContent = window.statsData.windows;
    
    // Показуємо модальне вікно
    document.getElementById('statsModal').classList.add('open');
}

function closeStatsModal() {
    document.getElementById('statsModal').classList.remove('open');
}

// ==========================================
// REQUESTS MANAGEMENT
// ==========================================

function checkPendingRequest(lessonId) {
    if (!allData || !allData.requests) return false;
    
    const hasPending = allData.requests.some(r => {
        const status = (r.status || '').toLowerCase();
        return r.lesson_id === lessonId && 
               r.teacher === selectedTeacher &&
               status === 'pending';
    });
    
    return hasPending;
}

function openRequestsModal() {
    if (!allData || !allData.requests) {
        document.getElementById('requestsList').innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>У вас немає заявок</p>
            </div>
        `;
        document.getElementById('requestsModal').classList.add('open');
        return;
    }
    
    const myRequests = allData.requests.filter(r => r.teacher === selectedTeacher);
    
    if (myRequests.length === 0) {
        document.getElementById('requestsList').innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>У вас немає заявок</p>
            </div>
        `;
    } else {
        const requestsHtml = myRequests.map(req => {
            const lesson = allData.live.lessons.find(l => l.id === req.lesson_id);
            if (!lesson) {
                console.warn('Lesson not found for request:', req.lesson_id);
                return '';
            }
            
            // Нормалізуємо status до lowercase
            const status = (req.status || '').toLowerCase();
            
            const statusIcons = {
                'pending': '⏳',
                'approved': '✅',
                'rejected': '❌'
            };
            
            const statusTexts = {
                'pending': 'Очікує розгляду',
                'approved': 'Схвалено',
                'rejected': 'Відхилено'
            };
            
            const statusColors = {
                'pending': '#f59e0b',
                'approved': '#22c55e',
                'rejected': '#ef4444'
            };
            
            const origDay = typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day;
            const origSlot = getTimeSlot(lesson.day, lesson.slot);
            
            // Формуємо HTML для всіх варіантів
            let variantsHtml = '';
            if (req.variants && req.variants.length > 0) {
                variantsHtml = req.variants.map((variant, index) => {
                    const newDay = typeof variant.day === 'number' ? DAYS_MAP[variant.day] : variant.day;
                    const newSlot = getTimeSlot(variant.day, variant.slot);
                    return `
                        <div style="padding: 10px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Варіант ${index + 1}:</div>
                            <div style="font-weight: 600; color: var(--text-main);">${newDay}</div>
                            <div style="font-size: 0.9rem; color: var(--text-main);">${variant.slot} пара • ${newSlot.time}</div>
                        </div>
                    `;
                }).join('');
            }
            
            return `
                <div class="request-card" style="margin-bottom: 16px; padding: 16px; background: var(--bg-body); border-radius: 12px; border-left: 4px solid ${statusColors[status]};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; color: var(--text-main);">${lesson.subject}</div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">${lesson.group}</div>
                        </div>
                        <div style="font-size: 1.5rem;">${statusIcons[status]}</div>
                    </div>
                    <div class="request-change-grid">
                        <div style="padding: 10px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Було:</div>
                            <div style="font-weight: 600; color: var(--text-main);">${origDay}</div>
                            <div style="font-size: 0.9rem; color: var(--text-main);">${lesson.slot} пара • ${origSlot.time}</div>
                        </div>
                        <div class="request-arrow">→</div>
                        <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
                            ${variantsHtml}
                        </div>
                    </div>
                    <div style="padding: 8px 12px; background: ${statusColors[status]}15; border-radius: 6px; text-align: center; font-weight: 600; color: ${statusColors[status]};">
                        ${statusTexts[status]}
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('requestsList').innerHTML = requestsHtml;
    }
    
    // Оновлюємо badge
    updateRequestsBadge();
    
    document.getElementById('requestsModal').classList.add('open');
}

function closeRequestsModal() {
    document.getElementById('requestsModal').classList.remove('open');
}

function updateRequestsBadge() {
    if (!allData || !allData.requests) return;
    
    const pendingCount = allData.requests.filter(r => {
        const status = (r.status || '').toLowerCase();
        return r.teacher === selectedTeacher && status === 'pending';
    }).length;
    
    const badge = document.getElementById('requestsBadgeHeader');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==========================================
// RENDER SCHEDULE
// ==========================================

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    
    if (!selectedTeacher) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-slash"></i>
                <p>Оберіть викладача зі списку вгорі</p>
            </div>
        `;
        return;
    }
    
    if (!allData) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-cloud-arrow-down"></i>
                <p>Завантажуємо дані...</p>
            </div>
        `;
        return;
    }
    
    const lessons = getTeacherLessons();
    
    if (lessons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <p>Немає пар на цьому тижні</p>
            </div>
        `;
        return;
    }
    
    // Group by day
    const byDay = {};
    lessons.forEach(lesson => {
        // Конвертуємо числовий день в назву якщо потрібно
        const dayName = typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day;
        
        if (!byDay[dayName]) {
            byDay[dayName] = [];
        }
        byDay[dayName].push(lesson);
    });
    
    // Sort each day by slot
    Object.keys(byDay).forEach(day => {
        byDay[day].sort((a, b) => a.slot - b.slot);
    });
    
    const today = new Date();
    const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const todayName = DAYS_ORDER[todayIndex];
    
    container.innerHTML = DAYS_ORDER.map(day => {
        const dayLessons = byDay[day] || [];
        
        // Не показуємо тільки суботу і неділю
        if (day === 'Субота' || day === 'Неділя') return '';
        
        const isToday = day === todayName;
        
        // Перевіряємо чи є хоч одна пара в цей день
        const hasAnyLesson = dayLessons.length > 0;
        
        if (!hasAnyLesson) {
            return `
                <div class="day-block">
                    <div class="day-header">
                        <div class="day-title">
                            ${day}
                            ${isToday ? '<span class="today-badge">Сьогодні</span>' : ''}
                        </div>
                    </div>
                    <div class="empty-day-message">
                        <i class="fa-solid fa-calendar-xmark"></i>
                        <span>Немає пар</span>
                    </div>
                </div>
            `;
        }
        
        // Знаходимо номер останньої пари
        const lastSlot = Math.max(...dayLessons.map(l => l.slot));
        
        // Створюємо масив слотів від 1 до останньої пари
        const slotsHtml = [];
        for (let slotNum = 1; slotNum <= lastSlot; slotNum++) {
            const lessonsInSlot = dayLessons.filter(l => l.slot === slotNum);
            if (lessonsInSlot.length > 0) {
                // Показуємо всі пари на цьому слоті
                lessonsInSlot.forEach(lesson => {
                    slotsHtml.push(renderLessonCard(lesson, isToday));
                });
            } else {
                slotsHtml.push(renderWindowSlot(day, slotNum, isToday));
            }
        }
        
        return `
            <div class="day-block">
                <div class="day-header">
                    <div class="day-title">
                        ${day}
                        ${isToday ? '<span class="today-badge">Сьогодні</span>' : ''}
                    </div>
                </div>
                ${slotsHtml.join('')}
            </div>
        `;
    }).join('');
    
    // Оновлюємо статистику
    updateStatistics();
}

function renderWindowSlot(day, slotNum, isToday) {
    const timeSlot = getTimeSlot(day, slotNum);
    
    return `
        <div class="window-card">
            <div class="window-info">
                <i class="fa-solid fa-mug-hot" style="font-size:1.2rem;"></i>
                <span>Вікно (вільний час)</span>
            </div>
            <div class="window-time">${timeSlot.time}</div>
        </div>
    `;
}

function renderLessonCard(lesson, isToday) {
    const typeClass = {
        'Лекція': 'lect',
        'Практична': 'prac',
        'Лабораторна': 'lab',
        'Семінар': 'sem'
    }[lesson.type] || '';
    
    const { isNow, isNext } = getLessonStatus(lesson, isToday);
    
    const statusBadge = isNow ? '<span class="status-badge now">Зараз</span>' : 
                        isNext ? '<span class="status-badge next">Наступна</span>' : '';
    
    const timeSlot = getTimeSlot(lesson.day, lesson.slot);
    
    // Індикатор коментаря
    const noteIndicator = lesson.note ? '<i class="fa-solid fa-circle-info note-indicator" title="Є додаткова інформація"></i>' : '';
    
    // Перевіряємо чи є pending заявка на цю пару
    const hasPendingRequest = checkPendingRequest(lesson.id);
    const pendingBadge = hasPendingRequest ? '<span class="pending-badge" title="Очікує розгляду перенесення">⏳</span>' : '';
    
    // Екрануємо апострофи для onclick
    const safeSubject = (lesson.subject || '').replace(/'/g, "\\'");
    const safeGroup = (lesson.group || '').replace(/'/g, "\\'");
    
    return `
        <div class="lesson-card type-${typeClass} ${isNow ? 'is-now' : ''}" onclick="showLessonDetails('${lesson.id}')" data-subject="${lesson.subject}" data-group="${lesson.group}">
            ${statusBadge}
            ${pendingBadge}
            <div class="l-header">
                <div class="l-num">${lesson.slot}</div>
                <div class="l-time">${timeSlot.start} - ${timeSlot.end}</div>
            </div>
            <div class="l-subject" onclick="event.stopPropagation(); activateHighlight('subject', '${safeSubject}', event)">
                ${lesson.subject}
                ${noteIndicator}
            </div>
            <div class="l-footer">
                <div class="l-details">
                    <div class="l-row clickable" onclick="event.stopPropagation(); activateHighlight('group', '${safeGroup}', event)">
                        <i class="fa-solid fa-users"></i>
                        <span>${lesson.group}</span>
                    </div>
                    <div class="l-row">
                        <i class="fa-solid fa-door-open"></i>
                        <span>${lesson.room}</span>
                    </div>
                    ${lesson.teacher2 ? `
                        <div class="l-row">
                            <i class="fa-solid fa-user-group"></i>
                            <span>${lesson.teacher2}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="type-tag">${lesson.type}</div>
            </div>
            <div class="l-actions">
                <button class="btn-action" onclick="event.stopPropagation(); openEditModal('${lesson.id}')">
                    <i class="fa-solid fa-pen"></i>
                    Редагувати
                </button>
                <button class="btn-action primary" onclick="event.stopPropagation(); startMoveMode('${lesson.id}')">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    Перенести
                </button>
            </div>
        </div>
    `;
}

function getLessonStatus(lesson, isToday) {
    if (!isToday) return { isNow: false, isNext: false };
    
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    const timeSlot = getTimeSlot(lesson.day, lesson.slot);
    const isNow = currentMin >= timeSlot.startMin && currentMin < timeSlot.endMin;
    const isNext = currentMin < timeSlot.startMin && currentMin >= (timeSlot.startMin - 30);
    
    return { isNow, isNext };
}

function getTeacherLessons() {
    if (!allData || !selectedTeacher) return [];
    
    return allData.live.lessons.filter(lesson => 
        (lesson.teacher === selectedTeacher || lesson.teacher2 === selectedTeacher) &&
        lesson.week === currentWeek
    );
}

// ==========================================
// LESSON DETAILS
// ==========================================

function showLessonDetails(lessonId) {
    const lesson = allData.live.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    
    const content = `
        <div class="m-row">
            <div class="m-label">Предмет</div>
            <div class="m-value">${lesson.subject}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Група</div>
            <div class="m-value">${lesson.group}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Викладач</div>
            <div class="m-value">${lesson.teacher}${lesson.teacher2 ? ', ' + lesson.teacher2 : ''}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Тип заняття</div>
            <div class="m-value">${lesson.type}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Аудиторія</div>
            <div class="m-value">${lesson.room}</div>
        </div>
        <div class="m-row">
            <div class="m-label">День</div>
            <div class="m-value">${typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Час</div>
            <div class="m-value">Пара ${lesson.slot}: ${getTimeSlot(lesson.day, lesson.slot).time}</div>
        </div>
        <div class="m-row">
            <div class="m-label">Тиждень</div>
            <div class="m-value">${lesson.week === 1 ? 'I (чисельник)' : 'II (знаменник)'}</div>
        </div>
        ${lesson.note ? `
            <div class="m-row">
                <div class="m-label"><i class="fa-solid fa-circle-info"></i> Додаткова інформація</div>
                <div class="m-value" style="white-space: pre-wrap; line-height: 1.6;">${linkify(lesson.note)}</div>
            </div>
        ` : ''}
    `;
    
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('open');
}

// Функція для перетворення URL в клікабельні посилання
function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--primary); text-decoration: underline;">$1</a>');
}

function closeDetailsModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ==========================================
// OLD REQUEST MODAL (DEPRECATED - kept for compatibility)
// ==========================================

/* REPLACED BY MOVE MODE WITH GRID
function openRequestModal(lessonId) {
    // Redirecting to new move mode
    startMoveMode(lessonId);
}

function selectVariant(index) {
    selectedVariant = window.currentVariants[index];
    
    document.querySelectorAll('.variant-option').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
}

async function submitRequest() {
    if (!currentLesson || selectedVariants.length === 0) {
        await customAlert('Оберіть хоча б один варіант для пари', 'Увага', 'warning');
        return;
    }
    
    const variantCount = selectedVariants.length;
    const variantWord = variantCount === 1 ? 'варіант' : variantCount < 5 ? 'варіанти' : 'варіантів';
    const confirmed = await customConfirm(
        `Відправити заявку на перенесення з ${variantCount} ${variantWord}?`,
        'Підтвердження',
        'Відправити',
        'Скасувати'
    );
    
    if (!confirmed) return;
    
    const requestData = {
        action: 'propose',
        data: {
            lessonId: currentLesson.id,
            teacher: selectedTeacher,
            subject: currentLesson.subject,
            group: currentLesson.group,
            original: {
                day: currentLesson.day,
                slot: currentLesson.slot,
                week: currentLesson.week
            },
            variants: selectedVariants.map((v, i) => ({
                day: v.day,
                slot: v.slot,
                priority: i + 1
            }))
        }
    };
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.result === 'success') {
            await customAlert('Заявку успішно надіслано!', 'Успішно', 'success');
            closeModal();
            await fetchSchedule(false);
        } else {
            await customAlert('Помилка: ' + (result.message || 'Невідома помилка'), 'Помилка', 'error');
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        await customAlert('Помилка відправки заявки', 'Помилка', 'error');
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    currentLesson = null;
    selectedVariants = [];
}
END OF DEPRECATED FUNCTIONS */

// ==========================================
// REQUESTS RENDERING
// ==========================================

// ==========================================
// MOVE MODE WITH CONFLICT VISUALIZATION
// ==========================================

function startMoveMode(lessonId) {
    const lesson = allData.live.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    
    moveMode.active = true;
    moveMode.lesson = lesson;
    moveMode.targetWeek = lesson.week; // За замовчуванням - тиждень поточної пари
    selectedVariants = []; // Скидаємо вибрані варіанти
    
    // Показуємо інформацію про пару
    const dayName = typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day;
    const timeSlot = getTimeSlot(lesson.day, lesson.slot);
    document.getElementById('moveLessonInfo').textContent = 
        `${lesson.subject} (${lesson.group}) • ${dayName}, ${timeSlot.time}`;
    
    // Оновлюємо кнопки тижнів
    updateMoveWeekButtons();
    
    // Генеруємо сітку тижня з конфліктами
    renderMoveGrid();
    
    // Показуємо модальне вікно
    document.getElementById('moveModal').classList.add('open');
}

function switchMoveWeek(week) {
    moveMode.targetWeek = week;
    updateMoveWeekButtons();
    renderMoveGrid();
}

function updateMoveWeekButtons() {
    document.getElementById('moveWeek1').classList.toggle('active', moveMode.targetWeek === 1);
    document.getElementById('moveWeek2').classList.toggle('active', moveMode.targetWeek === 2);
}

function renderMoveGrid() {
    const grid = document.getElementById('moveGrid');
    const lesson = moveMode.lesson;
    const targetWeek = moveMode.targetWeek;
    const lessonDayNum = typeof lesson.day === 'number' ? lesson.day : 
        parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === lesson.day));
    
    // Отримуємо всі пари цільового тижня для групи
    const groupLessons = allData.live.lessons.filter(l => 
        l.group === lesson.group && l.week === targetWeek
    );
    
    let html = '<div class="grid-header"></div>'; // Порожня клітинка
    
    // Заголовки днів
    for (let dayNum = 1; dayNum <= 5; dayNum++) {
        html += `<div class="grid-header">${DAYS_MAP[dayNum]}</div>`;
    }
    
    // Для кожного слоту
    for (let slotNum = 1; slotNum <= 5; slotNum++) {
        // Номер пари замість часу
        html += `<div class="grid-time">${slotNum} пара</div>`;
        
        // Для кожного дня
        for (let dayNum = 1; dayNum <= 5; dayNum++) {
            // Поточна пара тільки якщо той самий тиждень, день і слот
            const isCurrent = (targetWeek === lesson.week) && 
                             (dayNum === lessonDayNum) && 
                             (slotNum === lesson.slot);
            
            // Перевіряємо чи вибраний як варіант
            const variantIndex = selectedVariants.findIndex(v => v.day === dayNum && v.slot === slotNum);
            const isSelected = variantIndex >= 0;
            
            // Перевіряємо конфлікт групи (окрім самої поточної пари)
            const groupConflict = groupLessons.find(l => {
                const lDayNum = typeof l.day === 'number' ? l.day : 
                    parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
                return lDayNum === dayNum && l.slot === slotNum && l.id !== lesson.id;
            });
            
            // Перевіряємо конфлікт викладача
            const teacherConflict = allData.live.lessons.find(l => {
                const lDayNum = typeof l.day === 'number' ? l.day : 
                    parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
                return lDayNum === dayNum && l.slot === slotNum && l.week === targetWeek &&
                    l.id !== lesson.id &&
                    (l.teacher === lesson.teacher || l.teacher2 === lesson.teacher ||
                     l.teacher === lesson.teacher2 || l.teacher2 === lesson.teacher2);
            });
            
            // Перевіряємо конфлікт аудиторії
            const roomConflict = allData.live.lessons.find(l => {
                const lDayNum = typeof l.day === 'number' ? l.day : 
                    parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
                return lDayNum === dayNum && l.slot === slotNum && l.week === targetWeek &&
                    l.id !== lesson.id &&
                    l.room && lesson.room && l.room === lesson.room;
            });
            
            const conflict = groupConflict || teacherConflict || roomConflict;
            
            let slotClass = 'grid-slot';
            let slotContent = '';
            
            if (isCurrent) {
                slotClass += ' current';
                slotContent = '<div class="slot-group">Поточна</div>';
            } else if (isSelected) {
                slotClass += ' selected';
                slotContent = `<div class="slot-priority">${variantIndex + 1}</div><div class="slot-group">Обрано</div>`;
            } else if (conflict) {
                slotClass += ' conflict';
                let conflictText = '';
                if (groupConflict) {
                    conflictText = `Група: ${groupConflict.subject}`;
                } else if (teacherConflict) {
                    conflictText = `Викладач зайнятий`;
                } else if (roomConflict) {
                    conflictText = `Аудиторія зайнята`;
                }
                slotContent = `
                    <i class="fa-solid fa-triangle-exclamation slot-conflict-icon"></i>
                    <div class="slot-group" style="font-size: 0.75rem;">${conflictText}</div>
                `;
            } else {
                slotClass += ' available';
                slotContent = '<div class="slot-group">Вільно</div>';
            }
            
            const onClick = isCurrent ? '' : 
                `onclick="toggleMoveTarget(${dayNum}, ${slotNum})"`;
            
            html += `<div class="${slotClass}" ${onClick}>${slotContent}</div>`;
        }
    }
    
    grid.innerHTML = html;
}

function toggleMoveTarget(dayNum, slotNum) {
    const lesson = moveMode.lesson;
    const targetWeek = moveMode.targetWeek;
    
    // Перевіряємо чи це конфліктний слот
    const groupConflict = allData.live.lessons.find(l => {
        const lDayNum = typeof l.day === 'number' ? l.day : 
            parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
        return lDayNum === dayNum && l.slot === slotNum && l.week === targetWeek &&
            l.id !== lesson.id &&
            l.group === lesson.group;
    });
    
    const teacherConflict = allData.live.lessons.find(l => {
        const lDayNum = typeof l.day === 'number' ? l.day : 
            parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
        return lDayNum === dayNum && l.slot === slotNum && l.week === targetWeek &&
            l.id !== lesson.id &&
            (l.teacher === lesson.teacher || l.teacher2 === lesson.teacher || 
             l.teacher === lesson.teacher2 || l.teacher2 === lesson.teacher2);
    });
    
    const roomConflict = allData.live.lessons.find(l => {
        const lDayNum = typeof l.day === 'number' ? l.day : 
            parseInt(Object.keys(DAYS_MAP).find(key => DAYS_MAP[key] === l.day));
        return lDayNum === dayNum && l.slot === slotNum && l.week === targetWeek &&
            l.id !== lesson.id &&
            l.room && lesson.room && l.room === lesson.room;
    });
    
    const conflict = groupConflict || teacherConflict || roomConflict;
    
    // Забороняємо вибір конфліктних слотів
    if (conflict) {
        let conflictText = '';
        if (groupConflict) {
            conflictText = `група ${groupConflict.group} вже має пару в цей час (${groupConflict.subject})`;
        } else if (teacherConflict) {
            conflictText = `викладач ${teacherConflict.teacher} вже зайнятий в цей час (${teacherConflict.subject})`;
        } else if (roomConflict) {
            conflictText = `аудиторія ${roomConflict.room} вже зайнята в цей час (${roomConflict.subject})`;
        }
        customAlert(`❌ Неможливо обрати цей час:\n\n${conflictText}\n\nОберіть вільний час.`, 'Конфлікт розкладу', 'warning');
        return;
    }
    
    // Перевіряємо чи вже обраний
    const existingIndex = selectedVariants.findIndex(v => v.day === dayNum && v.slot === slotNum);
    
    if (existingIndex >= 0) {
        // Видаляємо якщо вже обраний
        selectedVariants.splice(existingIndex, 1);
    } else {
        // Перевіряємо ліміт 3 варіанти
        if (selectedVariants.length >= 3) {
            customAlert('Можна обрати максимум 3 варіанти', 'Увага', 'warning');
            return;
        }
        // Додаємо новий варіант
        selectedVariants.push({ day: dayNum, slot: slotNum });
    }
    
    // Оновлюємо відображення
    renderMoveGrid();
}

async function selectMoveTarget(dayNum, slotNum) {
    // Ця функція вже не використовується, замінена на toggleMoveTarget + submitRequest
}

function cancelMoveMode() {
    moveMode.active = false;
    moveMode.lesson = null;
    moveMode.targetWeek = 1;
    selectedVariants = [];
    document.getElementById('moveModal').classList.remove('open');
}

async function submitMoveRequest() {
    const lesson = moveMode.lesson;
    if (!lesson || selectedVariants.length === 0) {
        await customAlert('Оберіть хоча б один варіант для пари', 'Увага', 'warning');
        return;
    }
    
    const variantCount = selectedVariants.length;
    const variantWord = variantCount === 1 ? 'варіантом' : 'варіантами';
    const confirmed = await customConfirm(
        `Відправити заявку на перенесення з ${variantCount} ${variantWord}?`,
        'Підтвердження',
        'Відправити',
        'Скасувати'
    );
    
    if (!confirmed) return;
    
    const teacherData = allData?.live?.teachers?.find(t => t.name === selectedTeacher);
    
    const requestData = {
        action: 'propose',
        data: {
            lessonId: lesson.id,
            teacher: selectedTeacher,
            departmentCode: teacherData?.departmentCode || 'UNKNOWN',
            subject: lesson.subject,
            group: lesson.group,
            original: {
                day: lesson.day,
                slot: lesson.slot,
                week: lesson.week
            },
            variants: selectedVariants.map((v, i) => ({
                day: v.day,
                slot: v.slot,
                week: moveMode.targetWeek,
                priority: i + 1
            }))
        }
    };
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.result === 'success') {
            await customAlert('Заявку успішно надіслано!', 'Успішно', 'success');
            cancelMoveMode();
            await fetchSchedule(false);
        } else {
            await customAlert('Помилка: ' + (result.message || 'Невідома помилка'), 'Помилка', 'error');
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        await customAlert('Помилка відправки заявки', 'Помилка', 'error');
    }
}

// ==========================================
// EDIT LESSON
// ==========================================

function openEditModal(lessonId) {
    const lesson = allData.live.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    
    editingLesson = lesson;
    
    // Показуємо інформацію про пару
    const dayName = typeof lesson.day === 'number' ? DAYS_MAP[lesson.day] : lesson.day;
    const timeSlot = getTimeSlot(lesson.day, lesson.slot);
    const weekRoman = lesson.week === 1 ? 'I' : 'II';
    
    document.getElementById('editLessonInfo').innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${lesson.subject} • ${lesson.type}</div>
        <div style="color: var(--text-muted);">
            ${lesson.group} • ${dayName}, ${timeSlot.time} • ${weekRoman} тиждень
        </div>
    `;
    
    // Заповнюємо форму існуючими даними
    document.getElementById('editNote').value = lesson.note || '';
    
    // Завантажуємо практикуми для вкладки "Деталі"
    loadWorkshopsForEdit(lesson);
    
    // Скидаємо на першу вкладку
    switchEditTab('note');
    
    // Показуємо модальне вікно
    document.getElementById('editModal').classList.add('open');
}

function switchEditTab(tab) {
    // Перемикаємо активну вкладку
    document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.edit-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'note') {
        document.querySelector('.edit-tab:nth-child(1)').classList.add('active');
        document.getElementById('editTabNote').classList.add('active');
    } else if (tab === 'workshop') {
        document.querySelector('.edit-tab:nth-child(2)').classList.add('active');
        document.getElementById('editTabWorkshop').classList.add('active');
    }
}

function loadWorkshopsForEdit(lesson) {
    const select = document.getElementById('editWorkshop');
    const warning = document.getElementById('workshopWarning');
    
    select.disabled = false;
    
    // Знаходимо кафедру викладача через departmentcode пари або через Teachers
    let teacherDeptCode = lesson.departmentcode || lesson.departmentCode;
    
    if (!teacherDeptCode) {
        // Шукаємо через Teachers
        const teacherData = allData.live.teachers?.find(t => t.name === selectedTeacher);
        if (teacherData) {
            teacherDeptCode = teacherData.departmentCode;
        }
    }
    
    if (!teacherDeptCode) {
        select.innerHTML = '<option value="">Не вдалося визначити кафедру викладача</option>';
        select.disabled = true;
        return;
    }
    
    // Перевіряємо чи аудиторія належить кафедрі
    const currentRoomOnDept = (allData.live.workshops || []).some(w => 
        w.name === lesson.room && w.departmentCode === teacherDeptCode
    );
    
    // Дозволяємо міняти тільки якщо:
    // 1. Практична/Лабораторна/Семінар (будь-яка аудиторія)
    // 2. Лекція на кафедрі (аудиторія належить кафедрі)
    const canEdit = (lesson.type === 'Практична' || lesson.type === 'Лабораторна' || lesson.type === 'Семінар') || 
                   (lesson.type === 'Лекція' && currentRoomOnDept);
    
    if (!canEdit) {
        select.innerHTML = '<option value="">Зміна практикуму доступна для практичних/лабораторних/семінарів або лекцій на кафедрі</option>';
        select.disabled = true;
        warning.style.display = 'none';
        return;
    }
    
    // Фільтруємо практикуми по кафедрі
    const deptWorkshops = (allData.live.workshops || []).filter(w => w.departmentCode === teacherDeptCode);
    
    if (deptWorkshops.length === 0) {
        select.innerHTML = '<option value="">Немає доступних практикумів на кафедрі</option>';
        select.disabled = true;
        return;
    }
    
    // Формуємо список з перевіркою доступності
    select.innerHTML = deptWorkshops.map(w => {
        const isBusy = checkWorkshopBusy(w.name, lesson);
        const current = lesson.room === w.name;
        
        return `<option value="${w.name}" ${current ? 'selected' : ''} data-busy="${isBusy ? 'true' : 'false'}">
            ${w.name} ${current ? '(поточний)' : ''} ${isBusy ? '⚠️ зайнято' : '✅'}
        </option>`;
    }).join('');
    
    // Обробник зміни
    select.onchange = () => {
        const selectedOption = select.options[select.selectedIndex];
        const isBusy = selectedOption.getAttribute('data-busy') === 'true';
        
        if (isBusy && lesson.room !== select.value) {
            const conflictInfo = getWorkshopConflict(select.value, lesson);
            document.getElementById('workshopWarningText').innerHTML = conflictInfo;
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    };
}

function checkWorkshopBusy(workshopName, currentLesson) {
    // Перевіряємо чи є інша пара в цей же час в цьому практикумі
    return allData.live.lessons.some(l => 
        l.id !== currentLesson.id &&
        l.room === workshopName &&
        l.day === currentLesson.day &&
        l.slot === currentLesson.slot &&
        l.week === currentLesson.week
    );
}

function getWorkshopConflict(workshopName, currentLesson) {
    const conflict = allData.live.lessons.find(l => 
        l.id !== currentLesson.id &&
        l.room === workshopName &&
        l.day === currentLesson.day &&
        l.slot === currentLesson.slot &&
        l.week === currentLesson.week
    );
    
    if (conflict) {
        return `Практикум <strong>${workshopName}</strong> зайнятий:<br>${conflict.subject} (${conflict.group}, ${conflict.teacher})`;
    }
    return '';
}

function closeEditModal() {
    editingLesson = null;
    document.getElementById('editModal').classList.remove('open');
}

async function saveEditedLesson() {
    if (!editingLesson) return;
    
    const noteValue = document.getElementById('editNote').value.trim();
    const workshopSelect = document.getElementById('editWorkshop');
    const newWorkshop = workshopSelect.disabled ? null : workshopSelect.value;
    
    // Перевіряємо чи є попередження про конфлікт
    const warning = document.getElementById('workshopWarning');
    if (warning.style.display === 'block' && newWorkshop && newWorkshop !== editingLesson.room) {
        const confirmed = await customConfirm(
            'Обраний практикум зайнятий іншою парою. Все одно змінити?',
            'Підтвердження',
            'Так, змінити',
            'Скасувати'
        );
        
        if (!confirmed) return;
    }
    
    // Оновлюємо пару локально
    const lesson = allData.live.lessons.find(l => l.id === editingLesson.id);
    if (lesson) {
        lesson.note = noteValue;
        if (newWorkshop && newWorkshop !== editingLesson.room) {
            lesson.room = newWorkshop;
        }
    }
    
    // Відправляємо весь розклад на сервер (як в admin.html)
    const requestData = {
        action: 'admin_save',
        data: {
            lessons: allData.live.lessons
        }
    };
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.result === 'success') {
            await customAlert('Інформацію успішно збережено!', 'Успішно', 'success');
            closeEditModal();
            renderSchedule(); // Оновлюємо відображення
        } else {
            await customAlert('Помилка: ' + (result.message || 'Невідома помилка'), 'Помилка', 'error');
        }
    } catch (error) {
        console.error('Error saving lesson info:', error);
        await customAlert('Помилка збереження даних', 'Помилка', 'error');
    }
}

// ==========================================
// THEME TOGGLE
// ==========================================

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeIcon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeIcon').className = 'fa-solid fa-sun';
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
        if (highlightState.type === 'group' && card.dataset.group && card.dataset.group.includes(highlightState.value)) {
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

// ==========================================
// START
// ==========================================

init();