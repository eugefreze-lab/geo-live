/**
 * Гео-трансляция — Страница транслятора (index.html)
 * Логика: GPS → Supabase Realtime → зритель
 */

import { supabase, generateSessionId, getBaseUrl } from './config.js';

// ========================================
// Состояние
// ========================================
let sessionId = null;
let watchId = null;
let isBroadcasting = false;
let lastSentCoords = null;
let sendInterval = null;

// ========================================
// DOM элементы
// ========================================
const elements = {
    // UI панели
    setupSection: document.getElementById('setup-section'),
    broadcastSection: document.getElementById('broadcast-section'),
    sessionInfo: document.getElementById('session-info'),
    statusPanel: document.getElementById('status-panel'),

    // Ссылка для шеринга
    shareUrl: document.getElementById('share-url'),
    copyUrl: document.getElementById('copy-url'),
    sessionCode: document.getElementById('session-code'),

    // Статусы
    broadcastStatus: document.getElementById('broadcast-status'),
    accuracy: document.getElementById('accuracy'),
    lastUpdate: document.getElementById('last-update'),
    coordinates: document.getElementById('coordinates'),

    // Кнопки
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),

    // Сообщения
    errorMessage: document.getElementById('error-message'),
    successMessage: document.getElementById('success-message'),
};

// ========================================
// Утилиты
// ========================================
function formatAccuracy(meters) {
    if (meters < 1000) return `${Math.round(meters)} м`;
    return `${(meters / 1000).toFixed(1)} км`;
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatCoords(lat, lng) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function showError(msg) {
    elements.errorMessage.textContent = msg;
    elements.errorMessage.classList.remove('hidden');
    elements.successMessage.classList.add('hidden');
    console.error('❌', msg);
}

function showSuccess(msg) {
    elements.successMessage.textContent = msg;
    elements.successMessage.classList.remove('hidden');
    elements.errorMessage.classList.add('hidden');
    console.log('✅', msg);
}

function hideMessages() {
    elements.errorMessage.classList.add('hidden');
    elements.successMessage.classList.add('hidden');
}

// ========================================
// UI State Management
// ========================================
function showInitialState() {
    elements.setupSection.classList.remove('hidden');
    elements.broadcastSection.classList.add('hidden');
    elements.sessionInfo.classList.add('hidden');
    elements.statusPanel.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.startBtn.disabled = false;

    elements.shareUrl.value = '';
    elements.shareUrl.placeholder = 'Появится после получения GPS...';
    elements.copyUrl.disabled = true;
    elements.sessionCode.textContent = '—';
    elements.broadcastStatus.textContent = 'Ожидание запуска...';
    elements.broadcastStatus.className = 'status-value offline';
    elements.accuracy.textContent = '—';
    elements.lastUpdate.textContent = '—';
    elements.coordinates.textContent = '—';
    hideMessages();
}

function showBroadcastingState() {
    elements.setupSection.classList.add('hidden');
    elements.broadcastSection.classList.remove('hidden');
    elements.sessionInfo.classList.remove('hidden');
    elements.statusPanel.classList.remove('hidden');
    elements.startBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
}

function showStoppedState() {
    elements.setupSection.classList.remove('hidden');
    elements.broadcastSection.classList.add('hidden');
    elements.sessionInfo.classList.add('hidden');
    elements.statusPanel.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
}

// ========================================
// Supabase: отправка координат (upsert)
// ========================================
async function sendLocationToSupabase(lat, lng, accuracy) {
    const payload = {
        id: sessionId,
        lat,
        lng,
        accuracy,
        updated_at: new Date().toISOString(),
        is_active: true
    };

    console.log('📤 Отправка в Supabase:', payload);

    const { error } = await supabase
        .from('locations')
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        console.error('❌ Ошибка upsert:', error);
        throw error;
    }

    console.log('✅ Upsert успешен');
    return true;
}

async function deactivateSession() {
    if (!sessionId) return;
    const { error } = await supabase
        .from('locations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    if (error) console.error('❌ Deactivate error:', error);
}

// ========================================
// Геолокация
// ========================================
function startGeolocationWatch() {
    if (!navigator.geolocation) {
        throw new Error('Геолокация не поддерживается браузером');
    }

    watchId = navigator.geolocation.watchPosition(
        onLocationUpdate,
        onLocationError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
    console.log('📍 watchPosition запущен, watchId:', watchId);
}

function stopGeolocationWatch() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        console.log('📍 watchPosition остановлен');
        watchId = null;
    }
}

function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const now = new Date();

    // Обновляем UI
    elements.accuracy.textContent = formatAccuracy(accuracy);
    elements.lastUpdate.textContent = formatTime(now);
    elements.coordinates.textContent = formatCoords(latitude, longitude);
    elements.broadcastStatus.textContent = 'Трансляция активна';
    elements.broadcastStatus.className = 'status-value online';

    // Первая координата — генерируем ссылку
    if (!lastSentCoords) {
        lastSentCoords = { latitude, longitude };

        const shareUrl = `${getBaseUrl()}live.html?id=${sessionId}`;
        elements.shareUrl.value = shareUrl;
        elements.shareUrl.placeholder = '';
        elements.copyUrl.disabled = false;
        elements.sessionCode.textContent = sessionId;

        showSuccess(`Трансляция активна! Сессия: ${sessionId}. Ссылка готова.`);
    }

    // Отправляем в Supabase (throttle 3 сек через интервал)
    sendLocationToSupabase(latitude, longitude, accuracy)
        .catch(err => {
            showError(`Ошибка отправки: ${err.message}`);
        });
}

function onLocationError(error) {
    let msg = 'Ошибка геолокации: ';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg += 'Доступ запрещен. Разрешите GPS в настройках браузера.';
            break;
        case error.POSITION_UNAVAILABLE:
            msg += 'Местоположение недоступно. Выйдите на открытую территорию.';
            break;
        case error.TIMEOUT:
            msg += 'Превышено время ожидания. Попробуйте снова.';
            break;
        default:
            msg += error.message;
    }
    showError(msg);
    stopBroadcasting();
}

// ========================================
// Управление трансляцией
// ========================================
async function startBroadcasting() {
    hideMessages();

    if (!navigator.geolocation) {
        showError('Геолокация не поддерживается. Используйте HTTPS или localhost.');
        return;
    }

    // Проверяем HTTPS (кроме localhost)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showError('⚠️ Геолокация работает только на HTTPS. Используйте GitHub Pages или ngrok.');
        return;
    }

    sessionId = generateSessionId();
    console.log('🚀 Старт трансляции, sessionId:', sessionId);

    try {
        // Создаем/активируем сессию в БД
        await sendLocationToSupabase(null, null, null);

        // Запускаем GPS
        startGeolocationWatch();

        // Интервал для повторной отправки (3 сек) — на случай если GPS не обновляется
        sendInterval = setInterval(async () => {
            if (lastSentCoords) {
                await sendLocationToSupabase(
                    lastSentCoords.latitude,
                    lastSentCoords.longitude,
                    null // accuracy обновится при следующем GPS событии
                ).catch(console.error);
            }
        }, 3000);

        isBroadcasting = true;
        elements.broadcastStatus.textContent = 'Ожидание GPS...';
        elements.broadcastStatus.className = 'status-value warning';
        showBroadcastingState();

    } catch (err) {
        console.error('❌ Start broadcast error:', err);
        showError('Ошибка запуска: ' + err.message);
        await cleanup();
    }
}

async function stopBroadcasting() {
    hideMessages();
    await deactivateSession();
    await cleanup();
    showInitialState();
    showSuccess('Трансляция остановлена. Можно начать заново.');
}

async function cleanup() {
    stopGeolocationWatch();
    if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
    }
    isBroadcasting = false;
    sessionId = null;
    lastSentCoords = null;
}

// ========================================
// Копирование ссылки
// ========================================
async function copyShareUrl() {
    try {
        await navigator.clipboard.writeText(elements.shareUrl.value);
        showSuccess('Ссылка скопирована в буфер обмена!');
        setTimeout(hideMessages, 3000);
    } catch (e) {
        elements.shareUrl.select();
        document.execCommand('copy');
        showSuccess('Ссылка скопирована!');
        setTimeout(hideMessages, 3000);
    }
}

// ========================================
// Event Listeners
// ========================================
elements.startBtn.addEventListener('click', startBroadcasting);
elements.stopBtn.addEventListener('click', stopBroadcasting);
elements.copyUrl.addEventListener('click', copyShareUrl);

// ========================================
// Инициализация
// ========================================
function checkHttps() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showError('⚠️ Геолокация работает только на HTTPS или localhost. На GitHub Pages будет HTTPS автоматически.');
    }
}

showInitialState();
checkHttps();

// Cleanup на закрытие вкладки
window.addEventListener('beforeunload', () => {
    if (isBroadcasting && sessionId) {
        navigator.sendBeacon(
            `${SUPABASE_CONFIG.url}/rest/v1/locations?id=eq.${sessionId}`,
            JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
        );
    }
});