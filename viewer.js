/**
 * Гео-трансляция — Страница просмотра (live.html)
 * Подключается к Supabase Realtime и отображает маркер на карте Leaflet
 */

import { supabase } from './config.js';
import L from 'https://esm.sh/leaflet@1.9.4';

// ========================================
// Состояние
// ========================================
let sessionId = null;
let channel = null;
let map = null;
let marker = null;
let accuracyCircle = null;
let isConnected = false;
let lastUpdateTime = null;

// ========================================
// DOM элементы
// ========================================
const elements = {
    connectionStatus: document.getElementById('connection-status'),
    statusText: document.getElementById('status-text'),
    map: document.getElementById('map'),
    infoPanel: document.getElementById('info-panel'),
    waitingPanel: document.getElementById('waiting-panel'),
    waitingMessage: document.getElementById('waiting-message'),
    sessionIdDisplay: document.getElementById('session-id-display'),
    errorPanel: document.getElementById('error-panel'),
    errorMessage: document.getElementById('error-message'),
    viewAccuracy: document.getElementById('view-accuracy'),
    viewLastUpdate: document.getElementById('view-last-update'),
    viewStatus: document.getElementById('view-status'),
    viewCoordinates: document.getElementById('view-coordinates'),
    centerBtn: document.getElementById('center-btn'),
};

// ========================================
// Утилиты
// ========================================
function formatAccuracy(meters) {
    if (meters === null || meters === undefined) return '—';
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
    if (lat === null || lng === null) return '—';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function getSessionIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
}

function showError(msg) {
    elements.waitingPanel.classList.add('hidden');
    elements.infoPanel.classList.add('hidden');
    elements.errorPanel.classList.remove('hidden');
    elements.errorMessage.innerHTML = msg;
}

function showWaiting(msg = 'Ожидание координат от транслятора...') {
    elements.waitingPanel.classList.remove('hidden');
    elements.infoPanel.classList.add('hidden');
    elements.errorPanel.classList.add('hidden');
    elements.waitingMessage.textContent = msg;
}

function showMap() {
    elements.waitingPanel.classList.add('hidden');
    elements.infoPanel.classList.remove('hidden');
    elements.errorPanel.classList.add('hidden');
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    if (connected) {
        elements.connectionStatus.classList.add('online');
        elements.connectionStatus.classList.remove('offline');
        elements.statusText.textContent = 'Онлайн';
    } else {
        elements.connectionStatus.classList.remove('online');
        elements.connectionStatus.classList.add('offline');
        elements.statusText.textContent = 'Офлайн';
    }
}

// ========================================
// Инициализация карты Leaflet
// ========================================
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([55.7558, 37.6176], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    createCustomMarker();
    elements.centerBtn.addEventListener('click', centerOnMarker);

    return map;
}

function createCustomMarker() {
    const markerHtml = `
        <div class="marker-icon">
            <div class="marker-pulse"></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" fill="#2563eb" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
        </div>
    `;

    const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-marker',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -24]
    });

    marker = L.marker([0, 0], {
        icon: customIcon,
        zIndexOffset: 1000
    }).addTo(map);

    accuracyCircle = L.circle([0, 0], {
        radius: 0,
        className: 'accuracy-circle',
        interactive: false
    }).addTo(map);

    marker.setOpacity(0);
    accuracyCircle.setStyle({ opacity: 0, fillOpacity: 0 });
}

function updateMarker(lat, lng, accuracy) {
    if (!marker || !accuracyCircle) return;

    const latLng = L.latLng(lat, lng);
    marker.setLatLng(latLng);
    marker.setOpacity(1);

    if (accuracy && accuracy > 0) {
        accuracyCircle.setLatLng(latLng);
        accuracyCircle.setRadius(accuracy);
        accuracyCircle.setStyle({ opacity: 0.5, fillOpacity: 0.15 });
    } else {
        accuracyCircle.setStyle({ opacity: 0, fillOpacity: 0 });
    }

    if (map) {
        const bounds = map.getBounds();
        if (!bounds.contains(latLng)) {
            map.panTo(latLng, { animate: true, duration: 1 });
        }
    }
}

function centerOnMarker() {
    if (marker && marker.getLatLng()) {
        map.panTo(marker.getLatLng(), { animate: true, duration: 1 });
        map.setZoom(Math.max(map.getZoom(), 15));
    }
}

// ========================================
// Supabase Realtime подписка
// ========================================
async function subscribeToSession(id) {
    sessionId = id;
    elements.sessionIdDisplay.textContent = id;
    console.log('👁️ Viewer подписывается на сессию:', id);

    // Начальная загрузка данных
    const { data: session, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('❌ Ошибка загрузки сессии:', error);
        if (error.code === 'PGRST116') {
            showError(`Сессия "<strong>${id}</strong>" не найдена.<br>Возможные причины:<br>• Неверная ссылка<br>• Транслятор не запустил трансляцию<br>• Сессия устарела`);
        } else if (error.code === '42P01') {
            showError('Таблица "locations" не существует.<br>Выполните SQL в Supabase SQL Editor.');
        } else {
            showError(`Ошибка: ${error.message}`);
        }
        return;
    }

    console.log('📥 Начальное состояние:', session);

    if (!session.is_active) {
        showWaiting('Трансляция завершена.');
        elements.viewStatus.textContent = 'Завершена';
        elements.viewStatus.className = 'info-value offline';
        updateConnectionStatus(false);
        return;
    }

    if (session.lat !== null && session.lng !== null) {
        showMap();
        updateMarker(session.lat, session.lng, session.accuracy);
        updateInfoPanel(session);
        lastUpdateTime = new Date(session.updated_at);
        updateConnectionStatus(true);
    } else {
        showWaiting('Транслятор подключен, ожидание GPS...');
    }

    // Подписка на Realtime обновления
    channel = supabase
        .channel(`session:${id}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'locations',
                filter: `id=eq.${id}`
            },
            (payload) => {
                console.log('📥 Получено из Supabase:', payload.new);
                handleRealtimeUpdate(payload.new);
            }
        )
        .subscribe((status, err) => {
            console.log('🔌 Viewer Realtime status:', status, err);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Viewer SUBSCRIBED');
                updateConnectionStatus(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                console.error('❌ Viewer CHANNEL_ERROR');
                updateConnectionStatus(false);
            }
        });

    // Проверка связи каждые 30 сек
    setInterval(() => {
        if (channel && channel.state !== 'joined') {
            updateConnectionStatus(false);
        }
    }, 30000);
}

function handleRealtimeUpdate(session) {
    console.log('🔄 Обработка обновления:', session);

    if (!session.is_active) {
        elements.viewStatus.textContent = 'Завершена';
        elements.viewStatus.className = 'info-value offline';
        showWaiting('Транслятор остановил трансляцию.');
        updateConnectionStatus(false);
        return;
    }

    if (session.lat !== null && session.lng !== null) {
        if (!elements.waitingPanel.classList.contains('hidden')) {
            showMap();
        }
        updateMarker(session.lat, session.lng, session.accuracy);
        updateInfoPanel(session);
        lastUpdateTime = new Date(session.updated_at);
        updateConnectionStatus(true);
    }
}

function updateInfoPanel(session) {
    elements.viewAccuracy.textContent = formatAccuracy(session.accuracy);
    elements.viewLastUpdate.textContent = formatTime(new Date(session.updated_at));
    elements.viewCoordinates.textContent = formatCoords(session.lat, session.lng);

    if (session.is_active) {
        elements.viewStatus.textContent = 'Онлайн';
        elements.viewStatus.className = 'info-value online';
    } else {
        elements.viewStatus.textContent = 'Офлайн';
        elements.viewStatus.className = 'info-value offline';
    }
}

// Проверка устаревания данных (15 секунд)
function startStaleCheck() {
    setInterval(() => {
        if (lastUpdateTime && isConnected) {
            const staleMs = Date.now() - lastUpdateTime.getTime();
            if (staleMs > 15000) {
                elements.viewStatus.textContent = 'Нет связи';
                elements.viewStatus.className = 'info-value warning';
                updateConnectionStatus(false);
            }
        }
    }, 5000);
}

// ========================================
// Event Listeners
// ========================================
elements.centerBtn.addEventListener('click', centerOnMarker);

// ========================================
// Инициализация
// ========================================
function init() {
    sessionId = getSessionIdFromUrl();

    if (!sessionId) {
        showError('Не указан ID сессии.<br>Откройте ссылку вида <code>live.html?id=XXXXXX</code>');
        return;
    }

    initMap();
    subscribeToSession(sessionId);
    startStaleCheck();
}

init();