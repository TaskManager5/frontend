export function getErrorMessage(err) {
    const code = err?.error || 'unknown_error';

    const messages = {
        // Задачи
        deadline_past: 'Срок выполнения не может быть в прошлом',
        team_required_for_manager: 'Менеджер обязан выбрать команду',
        forbidden_team_set: 'Нельзя привязать задачу к команде',
        assignee_not_in_team: 'Выбранный исполнитель не состоит в команде',
        bad_request: 'Проверьте правильность заполнения полей',
        empty_patch: 'Нет данных для обновления',
        not_found: 'Запись не найдена',

        // Общие
        unauthorized: 'Сессия истекла. Войдите заново',
        forbidden: 'Недостаточно прав',
        invalid_credentials: 'Неверный логин или пароль',
        missing_token: 'Требуется авторизация',
        invalid_token: 'Недействительный токен',
        unknown_error: 'Неизвестная ошибка. Попробуйте позже',
    };

    return messages[code] || `Ошибка: ${code}`;
}
