/**
 * Конфигурация Supabase — настройки для клиента
 * Этот файл загружается первым и создает глобальный клиент supabase
 */

// Ваши ключи Supabase (publishable key — безопасен для клиентского кода)
export const SUPABASE_CONFIG = {
    url: 'https://ypnscpuhxmtgvkhgsiit.supabase.co',
    key: 'sb_publishable_v8MXbjI6TU7BViiWihGcTQ_uTP2ABPT'
};

// Инициализация клиента Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Утилита: генерация 6-символьного ID сессии
export function generateSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Утилита: формирование корректной базовой ссылки (работает и локально, и на GitHub Pages)
export function getBaseUrl() {
    const path = window.location.pathname
        .replace(/\/index\.html$/, '')
        .replace(/\/live\.html$/, '')
        .replace(/\/?$/, '/');
    return `${window.location.origin}${path}`;
}