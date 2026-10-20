#!/usr/bin/env node
/**
 * Скрипт проверки готовности проекта
 * Запуск: node verify-setup.js
 */

import fs from 'fs';
import path from 'path';

const PROJECT_DIR = path.dirname(path.resolve(process.argv[1]));

const REQUIRED_FILES = [
    'index.html',
    'live.html',
    'app.js',
    'viewer.js',
    'config.js',
    'style.css',
    'supabase-setup.sql',
    'README.md'
];

const OPTIONAL_FILES = [
    '.gitignore',
    'serve.py',
    'verify-setup.js'
];

function checkFile(filepath) {
    const fullPath = path.join(PROJECT_DIR, filepath);
    const exists = fs.existsSync(fullPath);
    const stats = exists ? fs.statSync(fullPath) : null;
    return { exists, size: stats?.size || 0 };
}

function verify() {
    console.log('🔍 Проверка проекта geo-live\n');
    console.log('📁 Директория:', PROJECT_DIR);
    console.log('');

    let allOk = true;

    console.log('📋 Обязательные файлы:');
    for (const file of REQUIRED_FILES) {
        const { exists, size } = checkFile(file);
        const status = exists ? '✅' : '❌';
        const sizeStr = exists ? `(${Math.round(size / 1024)} KB)` : '';
        console.log(`  ${status} ${file} ${sizeStr}`);
        if (!exists) allOk = false;
    }

    console.log('');
    console.log('📋 Дополнительные файлы:');
    for (const file of OPTIONAL_FILES) {
        const { exists, size } = checkFile(file);
        const status = exists ? '✅' : '⚪';
        const sizeStr = exists ? `(${Math.round(size / 1024)} KB)` : '';
        console.log(`  ${status} ${file} ${sizeStr}`);
    }

    console.log('');

    // Проверка ключевых строк в файлах
    console.log('🔑 Проверка ключевых зависимостей:');

    const indexHtml = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
    const liveHtml = fs.readFileSync(path.join(PROJECT_DIR, 'live.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
    const viewerJs = fs.readFileSync(path.join(PROJECT_DIR, 'viewer.js'), 'utf8');
    const configJs = fs.readFileSync(path.join(PROJECT_DIR, 'config.js'), 'utf8');
    const styleCss = fs.readFileSync(path.join(PROJECT_DIR, 'style.css'), 'utf8');

    const checks = [
        { name: 'Supabase CDN (esm.sh) в config.js', check: configJs.includes('@supabase/supabase-js') },
        { name: 'Leaflet CDN (esm.sh) в viewer.js', check: viewerJs.includes('leaflet@1.9.4') },
        { name: 'Leaflet CSS в index.html', check: indexHtml.includes('leaflet@1.9.4/dist/leaflet.css') },
        { name: 'Leaflet CSS в live.html', check: liveHtml.includes('leaflet@1.9.4/dist/leaflet.css') },
        { name: 'generateSessionId (6 chars) в config.js', check: configJs.includes('generateSessionId') && configJs.includes('i < 6') },
        { name: 'navigator.geolocation.watchPosition в app.js', check: appJs.includes('watchPosition') },
        { name: 'Supabase Realtime subscription в viewer.js', check: viewerJs.includes('postgres_changes') },
        { name: 'Upsert в Supabase (app.js)', check: appJs.includes('upsert') },
        { name: 'getBaseUrl для GitHub Pages', check: configJs.includes('getBaseUrl') && configJs.includes('window.location.origin') },
        { name: 'HTTPS предупреждение в index.html', check: indexHtml.includes('HTTPS') && indexHtml.includes('localhost') },
        { name: 'Responsive CSS (mobile)', check: styleCss.includes('@media (max-width: 480px)') },
        { name: 'config.js подключен в index.html', check: indexHtml.includes('./config.js') },
        { name: 'config.js подключен в live.html', check: liveHtml.includes('./config.js') },
        { name: 'Относительные пути (./app.js)', check: indexHtml.includes('./app.js') },
        { name: 'Относительные пути (./viewer.js)', check: liveHtml.includes('./viewer.js') },
        { name: 'Относительные пути (./style.css)', check: indexHtml.includes('./style.css') && liveHtml.includes('./style.css') },
        { name: 'Таблица locations в SQL', check: fs.readFileSync(path.join(PROJECT_DIR, 'supabase-setup.sql'), 'utf8').includes('locations') },
        { name: 'RLS политики в SQL', check: fs.readFileSync(path.join(PROJECT_DIR, 'supabase-setup.sql'), 'utf8').includes('ROW LEVEL SECURITY') },
        { name: 'Realtime publication в SQL', check: fs.readFileSync(path.join(PROJECT_DIR, 'supabase-setup.sql'), 'utf8').includes('supabase_realtime') },
    ];

    for (const { name, check } of checks) {
        console.log(`  ${check ? '✅' : '❌'} ${name}`);
        if (!check) allOk = false;
    }

    console.log('');
    console.log('━'.repeat(50));

    if (allOk) {
        console.log('🎉 ВСЁ ГОТОВО! Проект можно деплоить.');
        console.log('');
        console.log('📋 Следующие шаги:');
        console.log('   1. Выполните supabase-setup.sql в Supabase SQL Editor');
        console.log('   2. Включите Replication для таблицы locations');
        console.log('   3. Задеплойте на GitHub Pages / Vercel / Netlify');
        console.log('   4. Откройте сайт, нажмите "Начать трансляцию"');
    } else {
        console.log('⚠️  Есть проблемы. Исправьте перед деплоем.');
        process.exit(1);
    }
}

verify();