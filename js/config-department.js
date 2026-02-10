// ═══════════════════════════════════════════════════════════════
// КОНФІГУРАЦІЯ DEPARTMENT РЕЖИМУ (Single fixed department)
// ═══════════════════════════════════════════════════════════════

// Встановлюємо URL для department режиму
setModeURL('department');

/**
 * Fixed department identifier for single-department mode.
 * Used for filtering lessons - only classes belonging to this department are displayed.
 * Must match the code from the Departments sheet in the shared Google Spreadsheet.
 * @example 'MIT' - Кафедра Менеджменту ІТ-сфери
 * @example 'FM' - Кафедра Фізико-математичних наук
 */
const FIXED_DEPARTMENT_CODE = 'k1';

/**
 * Teacher app link configuration for department-generated teacher links.
 * Used when generating links from the Teachers modal.
 */
const TEACHER_LINK_CONFIG = {
    /** Base URL for teacher.html (relative or absolute) */
    baseUrl: 'teacher.html',
    /** URL parameter name for teacher identifier (name) */
    paramName: 'teacher'
};

// Department режим завантажений
console.log('Department config loaded. URL:', GOOGLE_SCRIPT_URL, 'Fixed department:', FIXED_DEPARTMENT_CODE);
