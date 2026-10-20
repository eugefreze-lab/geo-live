#!/usr/bin/env python3
"""
Простой HTTP-сервер для локальной разработки.
Запуск: python serve.py
Откроет: http://localhost:8000

ВАЖНО: Геолокация работает на localhost БЕЗ HTTPS.
Для теста на телефоне — используйте туннель (ngrok) или задеплойте на GitHub Pages.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # CORS для Supabase (если тестируете с локального хоста)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
        super().end_headers()

    def log_message(self, format, *args):
        # Красивый лог
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

if __name__ == "__main__":
    os.chdir(DIRECTORY)

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\n🚀 Сервер запущен: {url}")
        print(f"📁 Директория: {DIRECTORY}")
        print(f"\n📱 Для теста на телефоне используйте ngrok:")
        print(f"   npx ngrok http {PORT}")
        print(f"\n⛔ Для остановки: Ctrl+C\n")

        # Автооткрытие браузера
        try:
            webbrowser.open(url)
        except:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Сервер остановлен")