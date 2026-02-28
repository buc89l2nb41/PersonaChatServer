#!/bin/bash

# PersonaChat Backend 설치 스크립트
# Ubuntu 서버에서 실행

set -e

echo "🚀 PersonaChat Backend 설치를 시작합니다..."

# 현재 사용자 및 디렉토리 정보
CURRENT_USER=$(whoami)
CURRENT_DIR=$(pwd)
BUN_PATH=$(which bun 2>/dev/null || echo "$HOME/.bun/bin/bun")

# Bun 설치 확인 및 설치
if ! command -v bun &> /dev/null; then
    echo "📦 Bun이 설치되어 있지 않습니다. 설치를 시작합니다..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    BUN_PATH="$HOME/.bun/bin/bun"
    echo "✅ Bun 설치 완료"
else
    echo "✅ Bun이 이미 설치되어 있습니다: $(bun --version)"
    BUN_PATH=$(which bun)
fi

# 의존성 설치
echo "📦 의존성 설치 중..."
bun install

# .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다."
    if [ -f env.example ]; then
        echo "📝 env.example을 복사하여 .env 파일을 생성합니다..."
        cp env.example .env
        echo "✅ .env 파일이 생성되었습니다."
        echo "⚠️  중요: .env 파일을 열어 OPENROUTER_API_KEY와 FRONTEND_URL을 설정해주세요!"
    else
        echo "⚠️  env.example 파일도 없습니다. 수동으로 .env 파일을 생성해주세요."
    fi
else
    echo "✅ .env 파일이 이미 존재합니다."
fi

# systemd 서비스 파일 생성
echo "📝 systemd 서비스 파일 생성 중..."
SERVICE_FILE="personachat-backend.service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=PersonaChat Backend Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
Environment="PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.bun/bin"
ExecStart=$BUN_PATH run start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ 서비스 파일 생성 완료: $SERVICE_FILE"

# systemd 서비스 등록
if command -v systemctl &> /dev/null; then
    echo "🔧 systemd 서비스 등록 중..."
    
    # sudo 권한 확인
    if [ "$EUID" -eq 0 ]; then
        SUDO_CMD=""
    else
        SUDO_CMD="sudo"
        echo "⚠️  systemd 서비스 등록을 위해 sudo 권한이 필요합니다."
    fi
    
    $SUDO_CMD cp "$SERVICE_FILE" /etc/systemd/system/
    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable personachat-backend
    
    echo "✅ systemd 서비스 등록 완료"
    echo ""
    echo "서비스를 시작하려면 다음 명령을 실행하세요:"
    echo "  $SUDO_CMD systemctl start personachat-backend"
    echo ""
    echo "서비스 상태 확인:"
    echo "  $SUDO_CMD systemctl status personachat-backend"
    echo ""
    echo "로그 확인:"
    echo "  $SUDO_CMD journalctl -u personachat-backend -f"
else
    echo "⚠️  systemctl이 없습니다. systemd 서비스를 수동으로 등록해주세요."
    echo "   서비스 파일: $SERVICE_FILE"
fi

echo ""
echo "✅ 설치가 완료되었습니다!"
echo ""
echo "⚠️  중요: .env 파일을 확인하여 다음 변수들이 올바르게 설정되었는지 확인하세요:"
echo "   - OPENROUTER_API_KEY"
echo "   - FRONTEND_URL"
echo "   - PORT (선택사항, 기본값: 3001)"
