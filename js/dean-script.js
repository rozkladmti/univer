// ═══════════════════════════════════════════════════════════════
// DEAN SCRIPT - Тільки перегляд розкладу факультету
// ═══════════════════════════════════════════════════════════════

let currentWeek = 1;
let actualCurrentWeek = 1;
let lessons = [];
let facultyData = null;
let facultyCode = null;
let selectedDepartment = 'ALL';
let currentFilters = {};
let dictionaries = { 
    faculties: [], 
    departments: [], 
    teachers: [], 
    groups: [], 
    subjects: [], 
    workshops: [] 
};
let customAlertResolve = null;

// ═══════════════════════════════════════════════════════════════
// КАСТОМНІ АЛЕРТИ
// ═══════════════════════════════════════════════════════════════

function customAlert(message, title = 'Повідомлення', type = 'info') {
    return new Promise((resolve) => {
        customAlertResolve = resolve;
        const icons = {
            'info': '<i class="fa-solid fa-circle-info" style="color: #3b82f6;"></i>',
            'success': '<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i>',
            'warning': '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i>',
            'error': '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>'
        };
        
        document.getElementById('customAlertIcon').innerHTML = icons[type] || icons['info'];
        document.getElementById('customAlertTitle').textContent = title;
        document.getElementById('customAlertMessage').textContent = message;
        document.getElementById('customAlertActions').innerHTML = 
            '<button class="btn btn-primary" onclick="closeCustomAlert(true)" style="min-width: 100px;">OK</button>';
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

// ═══════════════════════════════════════════════════════════════
// ІНІЦІАЛІЗАЦІЯ
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoader('Завантаження…');
        
        // Отримуємо код факультету з URL
        const urlParams = new URLSearchParams(window.location.search);
        facultyCode = urlParams.get('faculty') || urlParams.get('code');
        
        if (!facultyCode) {
            facultyCode = 'f1';
            window.history.replaceState({}, '', `?faculty=${facultyCode}`);
        }
        
        // Завантажуємо дані
        await loadData();
        
        // Ініціалізуємо інтерфейс
        initInterface();
        
        // Відображаємо розклад
        renderSchedule();
        
        hideLoader();
    } catch (error) {
        console.error('Помилка:', error);
        showLoader(`<span style="color: #ef4444;">${error.message}</span>`);
    }
});

// ═══════════════════════════════════════════════════════════════
// ЗАВАНТАЖЕННЯ ДАНИХ
// ═══════════════════════════════════════════════════════════════

async function loadData() {
    // Завантажуємо довідники
    const dictResponse = await fetch(GOOGLE_SCRIPT_URL + '?action=get_dictionaries');
    dictionaries = await dictResponse.json();
    
    console.log('[DEAN] Dictionaries loaded:', dictionaries);
    console.log('[DEAN] Groups count:', dictionaries.groups?.length || 0);
    
    // Знаходимо факультет
    facultyData = dictionaries.faculties.find(f => f.code === facultyCode);
    if (!facultyData) {
        throw new Error('Факультет не знайдено');
    }
    
    // Завантажуємо розклад
    const scheduleResponse = await fetch(GOOGLE_SCRIPT_URL);
    const scheduleData = await scheduleResponse.json();
    
    if (scheduleData.result === 'success') {
        lessons = scheduleData.live.lessons || [];
        actualCurrentWeek = scheduleData.currentWeek || 1;
        currentWeek = actualCurrentWeek;
        const isNextWeek = scheduleData.isNextWeek || false;
        updateCurrentWeekIndicator(isNextWeek);
    } else {
        throw new Error('Помилка завантаження розкладу');
    }
}

// ═══════════════════════════════════════════════════════════════
// ІНІЦІАЛІЗАЦІЯ ІНТЕРФЕЙСУ
// ═══════════════════════════════════════════════════════════════

function initInterface() {
    // Встановлюємо назву факультету
    document.getElementById('facultyName').textContent = facultyData.name;
    
    // Встановлюємо поточний тиждень
    setWeek(currentWeek);
    
    // Рендеримо сітку розкладу
    renderGrid();
    
    // Рендеримо фільтр кафедр
    renderDepartmentFilter();
    
    // Заповнюємо списки для фільтрів
    populateFilterLists();
    
    // Запускаємо автооновлення підсвітки кожні 30 секунд
    setInterval(updateLiveStatus, 30000);
}

// ═══════════════════════════════════════════════════════════════
// ФІЛЬТР КАФЕДР
// ═══════════════════════════════════════════════════════════════

function renderDepartmentFilter() {
    const select = document.getElementById('departmentSelect');
    
    // Очищаємо select (залишаємо тільки опцію "Всі кафедри")
    select.innerHTML = '<option value="ALL">📚 Всі кафедри</option>';
    
    // Отримуємо кафедри факультету
    const facultyDepartments = dictionaries.departments.filter(
        dept => dept.facultyCode === facultyCode
    );
    
    // Додаємо кафедри
    facultyDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.code;
        option.textContent = dept.name;
        select.appendChild(option);
    });
}

function selectDepartmentFromDropdown() {
    const select = document.getElementById('departmentSelect');
    const code = select.value;
    selectDepartment(code);
}

function selectDepartment(code) {
    selectedDepartment = code;
    
    // Оновлюємо select
    const select = document.getElementById('departmentSelect');
    if (select) {
        select.value = code;
    }
    
    // Перерендерюємо розклад
    renderSchedule();
}

// ═══════════════════════════════════════════════════════════════
// СТАТИСТИКА
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ВІДОБРАЖЕННЯ СІТКИ РОЗКЛАДУ
// ═══════════════════════════════════════════════════════════════

function renderGrid() {
    const days = [1, 2, 3, 4, 5];
    
    days.forEach(day => {
        const col = document.getElementById(`day-${day}`);
        if (!col) return;
        
        const header = col.querySelector('.day-header');
        col.innerHTML = '';
        col.appendChild(header);
        
        TIME_SLOTS[day].forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'time-slot';
            slotDiv.dataset.day = day;
            slotDiv.dataset.slot = slot.id;
            
            slotDiv.innerHTML = `
                <div class="slot-header-row">
                    <div class="slot-number-badge">${slot.num}</div>
                    <div class="time-text">${slot.time}</div>
                </div>
            `;
            
            col.appendChild(slotDiv);
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// ВІДОБРАЖЕННЯ РОЗКЛАДУ
// ═══════════════════════════════════════════════════════════════

function renderSchedule() {
    // Очищаємо всі lesson-card
    document.querySelectorAll('.lesson-card').forEach(el => el.remove());
    
    // Фільтруємо пари
    let filteredLessons = lessons.filter(lesson => {
        // Фільтр по тижню
        if (lesson.week !== currentWeek) return false;
        
        // Фільтр по факультету
        const lessonDept = dictionaries.departments.find(d => d.code === lesson.departmentcode);
        if (!lessonDept || lessonDept.facultyCode !== facultyCode) return false;
        
        // Фільтр по кафедрі
        if (selectedDepartment !== 'ALL' && lesson.departmentcode !== selectedDepartment) {
            return false;
        }
        
        // Розширені фільтри
        if (currentFilters.teacher && lesson.teacher !== currentFilters.teacher) return false;
        if (currentFilters.group && lesson.group !== currentFilters.group) return false;
        if (currentFilters.subject && lesson.subject !== currentFilters.subject) return false;
        if (currentFilters.type && lesson.type !== currentFilters.type) return false;
        if (currentFilters.room && lesson.room !== currentFilters.room) return false;
        if (currentFilters.day && lesson.day !== parseInt(currentFilters.day)) return false;
        
        return true;
    });
    
    // Відображаємо пари в слотах
    filteredLessons.forEach(lesson => {
        const slotEl = document.querySelector(`.time-slot[data-day="${lesson.day}"][data-slot="${lesson.slot}"]`);
        if (slotEl) {
            const card = createLessonCard(lesson);
            slotEl.appendChild(card);
        }
    });
}

function createLessonCard(lesson) {
    const div = document.createElement('div');
    div.className = 'lesson-card';
    div.id = lesson.id;
    
    div.dataset.type = lesson.type;
    div.dataset.group = lesson.group;
    div.dataset.teacher = lesson.teacher;
    div.dataset.subject = lesson.subject;
    div.dataset.department = lesson.departmentcode || 'UNKNOWN';
    
    // Функція для отримання скорочення та іконки типу
    const getTypeDisplay = (type) => {
        const types = {
            'Лекція': { short: 'Лк', icon: 'fa-chalkboard-user' },
            'Лабораторна': { short: 'Лаб', icon: 'fa-desktop' },
            'Практична': { short: 'Пр', icon: 'fa-laptop-code' },
            'Семінар': { short: 'Сем', icon: 'fa-users' }
        };
        return types[type] || { short: type, icon: 'fa-book' };
    };
    
    const typeInfo = getTypeDisplay(lesson.type);
    
    // Логіка відображення аудиторії
    let roomDisplay = lesson.room || '';
    if (lesson.room && typeof lesson.room === 'string' && lesson.room.startsWith('Аудиторія ')) {
        const roomNum = lesson.room.replace('Аудиторія ', '');
        roomDisplay = 'Ауд. ' + roomNum;
    }
    
    let teacherDisplay = lesson.teacher || '';
    if (lesson.teacher2) teacherDisplay += `, ${lesson.teacher2}`;
    
    // Повна назва кафедри якщо показуємо всі кафедри
    let deptRowHtml = '';
    if (selectedDepartment === 'ALL') {
        const dept = dictionaries.departments.find(d => d.code === lesson.departmentcode);
        if (dept) {
            deptRowHtml = `<div class="info-row"><i class="fa-solid fa-building"></i> ${dept.name}</div>`;
        }
    }
    
    const safeGroup = (lesson.group || '').replace(/'/g, "\\'");
    const safeSubject = (lesson.subject || '').replace(/'/g, "\\'");
    const safeTeacher = (lesson.teacher || '').replace(/'/g, "\\'");
    
    div.innerHTML = `
        <div class="card-top-row">
            <span class="group-badge" data-tooltip="${lesson.group || ''}">${lesson.group || '-'}</span>
            <span class="type-badge" data-tooltip="${lesson.type}">
                <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.short}
            </span>
        </div>
        <div class="lesson-subject">${lesson.subject || ''}</div>
        <div class="lesson-footer">
            <div class="info-row teacher-row">
                <i class="fa-regular fa-user"></i> ${teacherDisplay}
            </div>
            <div class="info-row room-row">
                <i class="fa-solid fa-location-dot"></i> ${roomDisplay}
            </div>
            ${deptRowHtml}
            ${lesson.note ? `<div style="font-size:9px;color:#d97706;margin-top:2px;">${lesson.note}</div>` : ''}
        </div>
    `;
    
    return div;
}

// ═══════════════════════════════════════════════════════════════
// ТИЖНІ
// ═══════════════════════════════════════════════════════════════

function setWeek(week) {
    currentWeek = week;
    
    document.getElementById('btn-week-1').classList.toggle('active', week === 1);
    document.getElementById('btn-week-2').classList.toggle('active', week === 2);
    
    // Оновлюємо watermark
    const watermark = document.getElementById('week-watermark');
    if (watermark) {
        watermark.textContent = week;
    }
    
    renderSchedule();
    updateLiveStatus();
}

// ═══════════════════════════════════════════════════════════════
// РОЗШИРЕНИЙ ПОШУК
// ═══════════════════════════════════════════════════════════════

function populateFilterLists() {
    console.log('[DEAN] populateFilterLists called');
    console.log('[DEAN] dictionaries.groups:', dictionaries.groups?.length);
    
    const facultyDepartments = dictionaries.departments.filter(
        dept => dept.facultyCode === facultyCode
    );
    
    // Заповнюємо select кафедр
    const deptSelect = document.getElementById('advSearchDepartment');
    deptSelect.innerHTML = '<option value="">Всі кафедри</option>';
    facultyDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.code;
        option.textContent = dept.name;
        deptSelect.appendChild(option);
    });
    
    // Заповнюємо datalists
    const teachersList = document.getElementById('teachersList');
    const groupsList = document.getElementById('groupsList');
    const subjectsList = document.getElementById('subjectsList');
    const roomsList = document.getElementById('roomsList');
    
    // Викладачі факультету
    const facultyTeachers = dictionaries.teachers.filter(teacher =>
        facultyDepartments.some(dept => dept.code === teacher.departmentCode)
    );
    facultyTeachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.name;
        teachersList.appendChild(option);
    });
    
    // Групи - беремо з dictionaries і фільтруємо по факультету
    let groupsToUse = [];
    if (dictionaries.groups && dictionaries.groups.length > 0) {
        console.log('[DEAN] All groups:', dictionaries.groups.length);
        console.log('[DEAN] First group:', dictionaries.groups[0]);
        console.log('[DEAN] Current facultyCode:', facultyCode);
        
        // Фільтруємо групи по facultyCode
        const facultyGroups = dictionaries.groups.filter(group => {
            const groupFacultyCode = typeof group === 'object' ? group.facultyCode : null;
            if (dictionaries.groups.indexOf(group) < 3) {
                console.log('[DEAN] Group:', group.name, 'facultyCode:', groupFacultyCode, 'match:', groupFacultyCode === facultyCode);
            }
            return groupFacultyCode === facultyCode;
        });
        
        console.log('[DEAN] Faculty groups:', facultyGroups.length);
        groupsToUse = facultyGroups;
    } else {
        // Якщо немає в dictionaries - збираємо з lessons
        const uniqueGroups = [...new Set(lessons.map(l => l.group).filter(g => g))];
        groupsToUse = uniqueGroups.sort();
        console.log('[DEAN] Using groups from lessons:', groupsToUse.length);
    }
    
    console.log('[DEAN] groupsList element:', groupsList);
    console.log('[DEAN] Adding', groupsToUse.length, 'groups to datalist');
    
    groupsToUse.forEach(group => {
        const option = document.createElement('option');
        // Якщо group - об'єкт, беремо name або code, інакше - сам group
        option.value = typeof group === 'object' ? (group.name || group.code || group) : group;
        groupsList.appendChild(option);
    });
    
    console.log('[DEAN] groupsList children count:', groupsList.children.length);
    
    // Предмети факультету
    const facultySubjects = dictionaries.subjects.filter(subject =>
        facultyDepartments.some(dept => dept.code === subject.departmentCode)
    );
    facultySubjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.name || subject;
        subjectsList.appendChild(option);
    });
    
    // Аудиторії
    const rooms = [...new Set(lessons.map(l => l.room).filter(r => r))];
    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room;
        roomsList.appendChild(option);
    });
}

function toggleAdvancedSearch() {
    // Перевіряємо чи є активні фільтри
    const hasActiveFilters = Object.keys(currentFilters).length > 0 && 
                             Object.values(currentFilters).some(v => v !== '');
    
    if (hasActiveFilters) {
        // Якщо фільтри активні - скидаємо їх
        resetAdvancedSearch();
        updateFilterButtonState(false);
    } else {
        // Якщо фільтрів немає - відкриваємо модальне вікно
        openAdvancedSearch();
    }
}

function openAdvancedSearch() {
    document.getElementById('advancedSearchModal').classList.add('open');
}

function closeAdvancedSearch() {
    document.getElementById('advancedSearchModal').classList.remove('open');
}

function resetAdvancedSearch() {
    document.getElementById('advSearchDepartment').value = '';
    document.getElementById('advSearchTeacher').value = '';
    document.getElementById('advSearchGroup').value = '';
    document.getElementById('advSearchSubject').value = '';
    document.getElementById('advSearchType').value = '';
    currentFilters = {};
    
    renderSchedule();
}

function updateFilterButtonState(isActive) {
    const btn = document.getElementById('filterBtn');
    
    if (isActive) {
        // Активний стан - жовта кнопка з іншою іконкою
        if (btn) {
            btn.classList.add('btn-filter-active');
            btn.innerHTML = '<i class="fa-solid fa-filter-circle-xmark"></i> Скинути';
            btn.title = 'Скинути фільтри';
        }
    } else {
        // Неактивний стан - звичайна кнопка
        if (btn) {
            btn.classList.remove('btn-filter-active');
            btn.innerHTML = '<i class="fa-solid fa-filter"></i> Фільтри';
            btn.title = 'Пошук та фільтри';
        }
    }
}

function applyAdvancedSearch() {
    currentFilters = {
        department: document.getElementById('advSearchDepartment').value,
        teacher: document.getElementById('advSearchTeacher').value,
        group: document.getElementById('advSearchGroup').value,
        subject: document.getElementById('advSearchSubject').value,
        type: document.getElementById('advSearchType').value
    };
    
    // Перевіряємо чи є активні фільтри
    const hasActiveFilters = Object.values(currentFilters).some(v => v !== '');
    updateFilterButtonState(hasActiveFilters);
    
    // Якщо вибрано кафедру в фільтрі, оновлюємо вибір
    if (currentFilters.department) {
        selectDepartment(currentFilters.department);
    }
    
    closeAdvancedSearch();
    renderSchedule();
}

// ═══════════════════════════════════════════════════════════════
// СТАТИСТИКА
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ДОПОМОГА
// ═══════════════════════════════════════════════════════════════

function openHelp() {
    document.getElementById('helpModal').classList.add('open');
}

function closeHelp() {
    document.getElementById('helpModal').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// ОНОВЛЕННЯ ДАНИХ
// ═══════════════════════════════════════════════════════════════

async function reloadAll() {
    try {
        showLoader('Оновлення…');
        
        await loadData();
        renderSchedule();
        
        hideLoader();
        customAlert('Дані оновлено', 'Успішно', 'success');
    } catch (error) {
        hideLoader();
        customAlert('Помилка: ' + error.message, 'Помилка', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// ЛОАДЕР
// ═══════════════════════════════════════════════════════════════

function showLoader(text) {
    const loader = document.getElementById('global-loader');
    const subtitle = document.getElementById('global-loader-subtitle');
    
    if (subtitle) subtitle.innerHTML = text;
    loader.classList.remove('hidden');
}

function updateLoader(text) {
    const subtitle = document.getElementById('global-loader-subtitle');
    if (subtitle) subtitle.innerHTML = text;
}

function hideLoader() {
    document.getElementById('global-loader').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════
// ЕКСПОРТ В EXCEL
// ═══════════════════════════════════════════════════════════════

function exportToExcel() {
    try {
        // Створюємо нову книгу
        const wb = XLSX.utils.book_new();
        
        // ========== АРКУШ 1: Тиждень I ==========
        const week1Grid = createWeekGrid(1);
        const ws1 = XLSX.utils.aoa_to_sheet(week1Grid);
        
        // Об'єднуємо клітинки для заголовка (A1:F1)
        if (!ws1['!merges']) ws1['!merges'] = [];
        ws1['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
        
        // Об'єднуємо клітинки для дати (A2:F2)
        ws1['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
        
        // Встановлюємо ширину колонок
        ws1['!cols'] = [
            { wch: 10 },  // Номер пари
            { wch: 25 },  // Понеділок
            { wch: 25 },  // Вівторок
            { wch: 25 },  // Середа
            { wch: 25 },  // Четвер
            { wch: 25 }   // П'ятниця
        ];
        
        // Застосовуємо стилі
        applyExcelStyles(ws1, week1Grid);
        
        // Налаштування друку та закріплення для Тижня I
        setupPageSettings(ws1);
        
        XLSX.utils.book_append_sheet(wb, ws1, 'Тиждень I');
        
        // ========== АРКУШ 2: Тиждень II ==========
        const week2Grid = createWeekGrid(2);
        const ws2 = XLSX.utils.aoa_to_sheet(week2Grid);
        
        // Об'єднуємо клітинки для заголовка та дати
        if (!ws2['!merges']) ws2['!merges'] = [];
        ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
        ws2['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
        
        ws2['!cols'] = [
            { wch: 10 },
            { wch: 25 },
            { wch: 25 },
            { wch: 25 },
            { wch: 25 },
            { wch: 25 }
        ];
        
        // Застосовуємо стилі
        applyExcelStyles(ws2, week2Grid);
        
        // Налаштування друку та закріплення для Тижня II
        setupPageSettings(ws2);
        
        XLSX.utils.book_append_sheet(wb, ws2, 'Тиждень II');
        
        // Зберігаємо файл
        const date = new Date().toISOString().split('T')[0];
        const facultyName = facultyData.name.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ0-9]/g, '_');
        XLSX.writeFile(wb, `Розклад_${facultyName}_${date}.xlsx`);
        
    } catch (error) {
        console.error('Помилка експорту в Excel:', error);
        customAlert('Помилка при створенні Excel файлу: ' + error.message, 'Помилка', 'error');
    }
}

function applyExcelStyles(ws, grid) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Кольори
    const headerBg = { rgb: "D4BF9F" };
    const headerText = { rgb: "3D3020" };
    const dataBg = { rgb: "FFFFFF" };
    const dataText = { rgb: "5C4D3D" };
    const borderColor = { rgb: "D4BF9F" };
    
    const thinBorder = {
        style: "thin",
        color: borderColor
    };
    
    const mediumBorder = {
        style: "medium",
        color: { rgb: "B8956A" }
    };
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddress]) continue;
            
            const cell = ws[cellAddress];
            
            // Базові стилі
            cell.s = {
                alignment: { 
                    vertical: 'top', 
                    horizontal: 'left',
                    wrapText: true
                },
                border: {
                    top: thinBorder,
                    bottom: thinBorder,
                    left: thinBorder,
                    right: thinBorder
                }
            };
            
            // Заголовок (рядок 0)
            if (R === 0) {
                cell.s.fill = { fgColor: headerBg };
                cell.s.font = { bold: true, sz: 14, color: headerText };
                cell.s.alignment.horizontal = 'center';
            }
            // Дата (рядок 1)
            else if (R === 1) {
                cell.s.font = { sz: 10, color: dataText };
                cell.s.alignment.horizontal = 'center';
            }
            // Шапка таблиці (рядок 3)
            else if (R === 3) {
                cell.s.fill = { fgColor: headerBg };
                cell.s.font = { bold: true, sz: 11, color: headerText };
                cell.s.alignment.horizontal = 'center';
                cell.s.border = {
                    top: mediumBorder,
                    bottom: mediumBorder,
                    left: mediumBorder,
                    right: mediumBorder
                };
            }
            // Дані (рядки 4+)
            else if (R >= 4) {
                cell.s.fill = { fgColor: dataBg };
                cell.s.font = { sz: 9, color: dataText };
                
                // Перша колонка (номер пари) - центрувати
                if (C === 0) {
                    cell.s.font.bold = true;
                    cell.s.alignment.horizontal = 'center';
                    cell.s.border.right = mediumBorder;
                }
                
                // Товсті бордери
                cell.s.border.top = mediumBorder;
                cell.s.border.left = mediumBorder;
            }
        }
    }
}

function setupPageSettings(ws) {
    // Закріплення верхніх 4 рядків (рядки 0-3: заголовок, дата, порожній, шапка таблиці)
    ws['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft' };
    
    // Налаштування друку
    ws['!printHeader'] = { 
        rows: [0, 3] // Друкувати рядки 0-3 на кожній сторінці
    };
    
    // Налаштування сторінки
    ws['!pageSetup'] = {
        paperSize: 9,           // A4
        orientation: 'portrait', // Книжкова орієнтація
        scale: 100,              // Масштаб 100%
        fitToWidth: 1,           // Вмістити по ширині на 1 сторінку
        fitToHeight: 0,          // Висота не обмежена
        horizontalDpi: 300,      // Роздільна здатність
        verticalDpi: 300
    };
    
    // Поля сторінки (в дюймах: 1,8 см = 0.709 дюйма)
    ws['!margins'] = {
        left: 0.709,    // 1,8 см
        right: 0.709,   // 1,8 см
        top: 0.75,      // ~1,9 см (стандартне)
        bottom: 0.75,   // ~1,9 см (стандартне)
        header: 0.3,
        footer: 0.3
    };
    
    // Вирівнювання по центру горизонтально
    if (!ws['!pageSetup']) ws['!pageSetup'] = {};
    ws['!pageSetup'].horizontalCentered = true;
}

function createWeekGrid(week) {
    const grid = [];
    
    // Заголовок
    grid.push([`РОЗКЛАД ${facultyData.name.toUpperCase()} - ТИЖДЕНЬ ` + (week === 1 ? 'I (Чисельник)' : 'II (Знаменник)')]);
    // Дата створення
    const now = new Date();
    const created = now.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
    grid.push([`Створено ${created}`]);
    
    grid.push([]); // Порожній рядок
    
    // Шапка таблиці
    grid.push(['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця']);
    
    // Фільтруємо пари для цього тижня та факультету
    const weekLessons = lessons.filter(l => {
        if (parseInt(l.week) !== week) return false;
        const lessonDept = dictionaries.departments.find(d => d.code === l.departmentcode);
        return lessonDept && lessonDept.facultyCode === facultyCode;
    });
    
    // Групуємо пари по day-slot
    const grouped = {};
    weekLessons.forEach(l => {
        const key = `${l.day}-${l.slot}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(l);
    });
    
    // Для кожної пари (1-5)
    for (let slot = 1; slot <= 5; slot++) {
        const row = [`${slot} пара`];
        
        // Для кожного дня (1-5: ПН-ПТ)
        for (let day = 1; day <= 5; day++) {
            const key = `${day}-${slot}`;
            const lessonsInSlot = grouped[key] || [];
            
            if (lessonsInSlot.length === 0) {
                row.push('');
            } else {
                // Формуємо текст для комірки
                const cellText = lessonsInSlot.map(lesson => {
                    let text = '';
                    text += (lesson.teacher || '-') + '\n';
                    text += (lesson.subject || '') + '\n';
                    text += '(' + (lesson.type || '') + ')\n';
                    text += (lesson.group || '-') + '\n';
                    text += (lesson.room || '-');
                    
                    // Додаємо кафедру якщо показуємо всі
                    if (selectedDepartment === 'ALL') {
                        const dept = dictionaries.departments.find(d => d.code === lesson.departmentcode);
                        if (dept) {
                            text += '\n[' + dept.name + ']';
                        }
                    }
                    
                    return text;
                }).join('\n---\n'); // Роздільник між накладками
                
                row.push(cellText);
            }
        }
        
        grid.push(row);
    }
    
    return grid;
}

// ═══════════════════════════════════════════════════════════════
// ЕКСПОРТ В PNG
// ═══════════════════════════════════════════════════════════════

function exportToImage() {
    const el = document.getElementById('schedule-container');
    const h = el.style.height;
    el.style.height = 'auto';
    
    html2canvas(el, { 
        scale: 2, 
        backgroundColor: '#f1f5f9' 
    }).then(c => {
        const a = document.createElement('a');
        const facultyName = facultyData.name.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ0-9]/g, '_');
        a.download = `${facultyName}_week_${currentWeek}.png`;
        a.href = c.toDataURL();
        a.click();
        el.style.height = h;
    });
}

// ═══════════════════════════════════════════════════════════════
// ОНОВЛЕННЯ ІНДИКАТОРА ПОТОЧНОГО ТИЖНЯ
// ═══════════════════════════════════════════════════════════════

function updateCurrentWeekIndicator(isNextWeek = false) {
    const indicator = document.getElementById('currentWeekIndicator');
    const text = document.getElementById('currentWeekText');
    
    if (!indicator || !text) return;
    
    const weekRoman = actualCurrentWeek === 1 ? 'I' : 'II';
    
    if (isNextWeek) {
        text.textContent = `Наступний тиждень: ${weekRoman}`;
    } else {
        text.textContent = `Поточний тиждень: ${weekRoman}`;
    }
    
    indicator.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
// ПІДСВІТКА ПОТОЧНОГО ДНЯ ТА ПАРИ
// ═══════════════════════════════════════════════════════════════

function updateLiveStatus() {
    const now = new Date();
    const d = now.getDay();
    
    // Видаляємо всі підсвітки
    document.querySelectorAll('.day-column').forEach(c => c.classList.remove('current-day'));
    
    // Підсвічуємо тільки якщо це поточний тиждень і робочий день
    if (d >= 1 && d <= 5 && currentWeek === actualCurrentWeek) {
        const dayCol = document.getElementById(`day-${d}`);
        if (dayCol) dayCol.classList.add('current-day');
    }
}
