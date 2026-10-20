-- ========================================
-- Supabase Setup для Гео-трансляции
-- Таблица: locations (вместо sessions)
-- ИДЕМПОТЕНТНЫЙ — безопасен для повторного запуска
-- Выполните в Supabase SQL Editor
-- ========================================

-- 1. Таблица locations (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,                    -- 6-символьный код сессии (например, "A1B2C3")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    lat DOUBLE PRECISION,                   -- Широта
    lng DOUBLE PRECISION,                   -- Долгота
    accuracy DOUBLE PRECISION               -- Точность в метрах (radius)
);

-- 2. Включаем Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 3. Политики доступа (анонимный ключ имеет полный доступ для простоты)
-- Пересоздаём чисто: DROP IF EXISTS + CREATE

DROP POLICY IF EXISTS "Anyone can read active locations" ON public.locations;
DROP POLICY IF EXISTS "Anon can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Anon can update locations" ON public.locations;
DROP POLICY IF EXISTS "Anon can upsert locations" ON public.locations;

-- Чтение: только активные локации (для зрителя)
CREATE POLICY "Anyone can read active locations"
    ON public.locations FOR SELECT
    USING (is_active = TRUE);

-- Вставка: транслятор создаёт запись
CREATE POLICY "Anon can insert locations"
    ON public.locations FOR INSERT
    WITH CHECK (TRUE);

-- Обновление: транслятор обновляет координаты
CREATE POLICY "Anon can update locations"
    ON public.locations FOR UPDATE
    USING (TRUE) WITH CHECK (TRUE);

-- Upsert: нужен для insert ... on conflict (PostgreSQL использует INSERT ... ON CONFLICT)
-- Политика INSERT покрывает это, но добавим явно для надежности
CREATE POLICY "Anon can upsert locations"
    ON public.locations FOR INSERT
    WITH CHECK (TRUE);

-- 4. Realtime: добавляем таблицу в publication (безопасно для повторного запуска)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.locations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;

-- 5. Индекс для быстрого поиска по is_active
CREATE INDEX IF NOT EXISTS idx_locations_active
    ON public.locations(is_active) WHERE is_active = TRUE;

-- ========================================
-- ПРОВЕРКА (выполните отдельно после Run)
-- ========================================
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Должно вернуть строку: supabase_realtime | public | locations

-- ========================================
-- ТЕСТОВАЯ ПРОВЕРКА (опционально)
-- ========================================
-- INSERT INTO public.locations (id, is_active, lat, lng, accuracy)
-- VALUES ('TEST12', TRUE, 55.7558, 37.6176, 10)
-- ON CONFLICT (id) DO UPDATE SET
--     is_active = EXCLUDED.is_active,
--     lat = EXCLUDED.lat,
--     lng = EXCLUDED.lng,
--     accuracy = EXCLUDED.accuracy,
--     updated_at = NOW();

-- SELECT * FROM public.locations WHERE id = 'TEST12';