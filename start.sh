#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                    Second Brain AI System - Smart Starter                    ║
# ║                                                                              ║
# ║  Interactive CLI to check dependencies, configure environment, and launch   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -e  # Exit on error

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION & CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Minimum versions required
MIN_DOCKER_VERSION="20.0.0"
MIN_NODE_VERSION="18"
MIN_GIT_VERSION="2.0.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Icons
ICON_CHECK="✅"
ICON_CROSS="❌"
ICON_WARN="⚠️ "
ICON_INFO="ℹ️ "
ICON_ROCKET="🚀"
ICON_BRAIN="🧠"
ICON_GEAR="⚙️ "
ICON_KEY="🔑"
ICON_DOCKER="🐳"
ICON_DB="🗄️ "
ICON_WEB="🌐"
ICON_STOP="🛑"
ICON_CLEAN="🧹"
ICON_LOG="📋"
ICON_HEALTH="💚"

# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

# Print colored message
print_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Print section header
print_header() {
    echo
    print_color "$CYAN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_color "$BOLD$CYAN" "  $1"
    print_color "$CYAN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
}

# Print banner
print_banner() {
    echo
    print_color "$MAGENTA" "  ╔═══════════════════════════════════════════════════════════════════╗"
    print_color "$MAGENTA" "  ║                                                                   ║"
    print_color "$MAGENTA" "  ║   $ICON_BRAIN  ${BOLD}SECOND BRAIN AI SYSTEM${NC}${MAGENTA}                                 ║"
    print_color "$MAGENTA" "  ║      Your Personal Cognitive Operating System                    ║"
    print_color "$MAGENTA" "  ║                                                                   ║"
    print_color "$MAGENTA" "  ╚═══════════════════════════════════════════════════════════════════╝"
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Compare versions (returns 0 if $1 >= $2)
version_gte() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Clear screen and show banner
clear_and_banner() {
    clear
    print_banner
}

# Generate secure random string
generate_secret() {
    if command_exists openssl; then
        openssl rand -hex 32
    elif command_exists node; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    else
        # Fallback: use /dev/urandom
        head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64
    fi
}

# Prompt for yes/no with default
prompt_yn() {
    local prompt=$1
    local default=${2:-y}
    local response

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    read -r -p "$prompt" response
    response=${response:-$default}

    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Wait for key press
wait_for_key() {
    local prompt=${1:-"Press any key to continue..."}
    read -n 1 -s -r -p "$prompt"
    echo
}

# Spinner animation
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while ps -p "$pid" > /dev/null 2>&1; do
        for i in $(seq 0 9); do
            printf "\r  [${spinstr:$i:1}] %s" "$2"
            sleep $delay
        done
    done
    printf "\r"
}

# ══════════════════════════════════════════════════════════════════════════════
# DEPENDENCY CHECKS
# ══════════════════════════════════════════════════════════════════════════════

check_docker() {
    print_color "$BLUE" "$ICON_DOCKER Checking Docker..."

    if ! command_exists docker; then
        print_color "$RED" "  $ICON_CROSS Docker is not installed"
        echo
        print_color "$YELLOW" "  Please install Docker:"
        case "$(uname -s)" in
            Darwin)
                echo "    brew install --cask docker"
                echo "    or download from: https://www.docker.com/products/docker-desktop"
                ;;
            Linux)
                echo "    curl -fsSL https://get.docker.com | sh"
                echo "    sudo usermod -aG docker \$USER"
                ;;
            *)
                echo "    https://docs.docker.com/get-docker/"
                ;;
        esac
        return 1
    fi

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_color "$RED" "  $ICON_CROSS Docker daemon is not running"
        echo
        print_color "$YELLOW" "  Please start Docker Desktop or the Docker daemon"
        case "$(uname -s)" in
            Darwin)
                echo "    Open Docker Desktop application"
                ;;
            Linux)
                echo "    sudo systemctl start docker"
                ;;
        esac
        return 1
    fi

    local docker_version
    docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null | cut -d'-' -f1)

    if version_gte "$docker_version" "$MIN_DOCKER_VERSION"; then
        print_color "$GREEN" "  $ICON_CHECK Docker $docker_version installed and running"
    else
        print_color "$YELLOW" "  $ICON_WARN Docker $docker_version detected (recommended: $MIN_DOCKER_VERSION+)"
    fi

    return 0
}

check_docker_compose() {
    print_color "$BLUE" "$ICON_DOCKER Checking Docker Compose..."

    if docker compose version >/dev/null 2>&1; then
        local compose_version
        compose_version=$(docker compose version --short 2>/dev/null | cut -d'v' -f2)
        print_color "$GREEN" "  $ICON_CHECK Docker Compose $compose_version available"
        return 0
    elif command_exists docker-compose; then
        local compose_version
        compose_version=$(docker-compose version --short 2>/dev/null)
        print_color "$GREEN" "  $ICON_CHECK Docker Compose (standalone) $compose_version available"
        # Set flag to use standalone compose
        USE_STANDALONE_COMPOSE=true
        return 0
    else
        print_color "$RED" "  $ICON_CROSS Docker Compose is not available"
        echo
        print_color "$YELLOW" "  Docker Compose should be included with Docker Desktop"
        echo "    If not, install it: https://docs.docker.com/compose/install/"
        return 1
    fi
}

check_git() {
    print_color "$BLUE" "$ICON_GEAR Checking Git..."

    if ! command_exists git; then
        print_color "$YELLOW" "  $ICON_WARN Git is not installed (optional but recommended)"
        return 0  # Non-fatal
    fi

    local git_version
    git_version=$(git --version | cut -d' ' -f3)

    if version_gte "$git_version" "$MIN_GIT_VERSION"; then
        print_color "$GREEN" "  $ICON_CHECK Git $git_version installed"
    else
        print_color "$YELLOW" "  $ICON_WARN Git $git_version detected (recommended: $MIN_GIT_VERSION+)"
    fi

    return 0
}

check_node() {
    print_color "$BLUE" "$ICON_GEAR Checking Node.js (optional)..."

    if ! command_exists node; then
        print_color "$DIM" "  $ICON_INFO Node.js not found (Docker will handle dependencies)"
        return 0
    fi

    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

    if [ "$node_version" -ge "$MIN_NODE_VERSION" ]; then
        print_color "$GREEN" "  $ICON_CHECK Node.js v$(node --version | cut -d'v' -f2) installed"
    else
        print_color "$YELLOW" "  $ICON_WARN Node.js v$node_version detected (v$MIN_NODE_VERSION+ recommended for local dev)"
    fi

    return 0
}

check_ports() {
    print_color "$BLUE" "$ICON_WEB Checking required ports..."

    local ports_in_use=()
    local required_ports=(5173 3000 5432 8080 5001 5002)

    for port in "${required_ports[@]}"; do
        if lsof -i ":$port" >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
            ports_in_use+=("$port")
        fi
    done

    if [ ${#ports_in_use[@]} -eq 0 ]; then
        print_color "$GREEN" "  $ICON_CHECK All required ports are available (5173, 3000, 5432, 8080, 5001, 5002)"
    else
        print_color "$YELLOW" "  $ICON_WARN Ports already in use: ${ports_in_use[*]}"
        echo "    This may cause conflicts. Consider stopping existing services."
        return 1
    fi

    return 0
}

run_dependency_checks() {
    print_header "$ICON_GEAR Checking Dependencies"

    local all_passed=true

    check_docker || all_passed=false
    check_docker_compose || all_passed=false
    check_git
    check_node
    check_ports || true  # Non-fatal

    echo

    if [ "$all_passed" = false ]; then
        print_color "$RED" "$ICON_CROSS Some required dependencies are missing. Please install them and try again."
        return 1
    fi

    print_color "$GREEN" "$ICON_CHECK All required dependencies are satisfied!"
    return 0
}

# ══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT SETUP
# ══════════════════════════════════════════════════════════════════════════════

check_env_file() {
    if [ -f ".env" ]; then
        return 0
    fi
    return 1
}

create_env_file() {
    print_header "$ICON_KEY Environment Configuration"

    if check_env_file; then
        print_color "$GREEN" "  $ICON_CHECK .env file already exists"
        echo

        if prompt_yn "  Do you want to regenerate secrets?" "n"; then
            regenerate_secrets
        fi

        return 0
    fi

    print_color "$YELLOW" "  $ICON_INFO No .env file found. Creating one..."
    echo

    # Check for template
    if [ ! -f ".env.example" ]; then
        print_color "$RED" "  $ICON_CROSS .env.example template not found!"
        print_color "$YELLOW" "  Creating minimal .env file..."
        create_minimal_env
        return 0
    fi

    # Copy template
    cp .env.example .env
    print_color "$GREEN" "  $ICON_CHECK Created .env from template"

    # Generate secrets
    echo
    print_color "$BLUE" "  $ICON_KEY Generating secure secrets..."

    local jwt_secret
    local encryption_key
    local db_password

    jwt_secret=$(generate_secret)
    encryption_key=$(generate_secret)
    db_password=$(generate_secret | head -c 24)  # Shorter for DB password

    # Update secrets in .env
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS
        sed -i '' "s/JWT_SECRET=your-secret-key-here/JWT_SECRET=$jwt_secret/" .env
        sed -i '' "s/ENCRYPTION_KEY=your-encryption-key-here/ENCRYPTION_KEY=$encryption_key/" .env
        sed -i '' "s/DB_PASSWORD=dev_password/DB_PASSWORD=$db_password/" .env
        # Update DATABASE_URL with new password
        sed -i '' "s|postgresql://secondbrain:dev_password@|postgresql://secondbrain:$db_password@|" .env
    else
        # Linux
        sed -i "s/JWT_SECRET=your-secret-key-here/JWT_SECRET=$jwt_secret/" .env
        sed -i "s/ENCRYPTION_KEY=your-encryption-key-here/ENCRYPTION_KEY=$encryption_key/" .env
        sed -i "s/DB_PASSWORD=dev_password/DB_PASSWORD=$db_password/" .env
        sed -i "s|postgresql://secondbrain:dev_password@|postgresql://secondbrain:$db_password@|" .env
    fi

    print_color "$GREEN" "  $ICON_CHECK Generated secure JWT_SECRET"
    print_color "$GREEN" "  $ICON_CHECK Generated secure ENCRYPTION_KEY"
    print_color "$GREEN" "  $ICON_CHECK Generated secure DB_PASSWORD"

    echo
    print_color "$CYAN" "  ${BOLD}Configuration Summary:${NC}"
    echo "    • Database:    PostgreSQL (Docker)"
    echo "    • Vector DB:   Weaviate (Docker)"
    echo "    • Embedding:   Local ECAPA-TDNN service"
    echo "    • Security:    Auto-generated secrets"
    echo

    # Prompt for OpenAI key
    print_color "$YELLOW" "  $ICON_INFO OpenAI API key is optional but enables AI features"
    if prompt_yn "  Do you want to configure an OpenAI API key now?" "n"; then
        echo
        read -r -p "  Enter your OpenAI API key (sk-...): " openai_key
        if [ -n "$openai_key" ]; then
            if [[ "$(uname)" == "Darwin" ]]; then
                sed -i '' "s/OPENAI_API_KEY=sk-your-key-here/OPENAI_API_KEY=$openai_key/" .env
            else
                sed -i "s/OPENAI_API_KEY=sk-your-key-here/OPENAI_API_KEY=$openai_key/" .env
            fi
            print_color "$GREEN" "  $ICON_CHECK OpenAI API key configured"
        fi
    fi

    echo
    print_color "$GREEN" "  $ICON_CHECK Environment configuration complete!"
}

create_minimal_env() {
    local jwt_secret
    local encryption_key
    local db_password

    jwt_secret=$(generate_secret)
    encryption_key=$(generate_secret)
    db_password=$(generate_secret | head -c 24)

    cat > .env << EOF
# Second Brain AI System - Auto-generated configuration
# Generated on: $(date)

# Frontend Configuration
VITE_API_URL=http://localhost:3000

# Backend Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database Configuration
DATABASE_URL=postgresql://secondbrain:${db_password}@postgres:5432/second_brain
DB_PASSWORD=${db_password}
WEAVIATE_URL=http://weaviate:8080

# LLM Configuration (optional)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4-turbo

# HuggingFace Configuration (optional)
HF_TOKEN=
HF_HUB_OFFLINE=0

# Memory Configuration
MEMORY_RETENTION_DAYS=7
SUMMARIZATION_SCHEDULE=daily
MAX_SHORT_TERM_MEMORY_SIZE=10000

# Security (auto-generated - keep these secret!)
JWT_SECRET=${jwt_secret}
ENCRYPTION_KEY=${encryption_key}

# Logging
LOG_LEVEL=info
EOF

    print_color "$GREEN" "  $ICON_CHECK Created minimal .env file with auto-generated secrets"
}

regenerate_secrets() {
    echo
    print_color "$BLUE" "  $ICON_KEY Regenerating secrets..."

    local jwt_secret
    local encryption_key

    jwt_secret=$(generate_secret)
    encryption_key=$(generate_secret)

    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" .env
        sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" .env
    else
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" .env
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" .env
    fi

    print_color "$GREEN" "  $ICON_CHECK Secrets regenerated successfully"
    print_color "$YELLOW" "  $ICON_WARN Note: Existing sessions will be invalidated"
}

# ══════════════════════════════════════════════════════════════════════════════
# SERVICE MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

# Get the appropriate docker compose command
get_compose_cmd() {
    if [ "$USE_STANDALONE_COMPOSE" = true ]; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

start_services() {
    print_header "$ICON_ROCKET Starting Services"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    print_color "$BLUE" "  Building and starting all services..."
    print_color "$DIM" "  This may take a few minutes on first run..."
    echo

    if prompt_yn "  Build fresh images? (slower but ensures latest code)" "n"; then
        $compose_cmd up --build -d
    else
        $compose_cmd up -d
    fi

    echo
    print_color "$GREEN" "  $ICON_CHECK Services started!"

    # Wait for health checks
    wait_for_services
}

update_system() {
    print_header "$ICON_ROCKET Updating System"

    print_color "$BLUE" "  Pulling latest changes from git..."
    echo

    if ! git pull; then
        print_color "$RED" "  $ICON_CROSS Git pull failed!"
        return 1
    fi

    echo
    print_color "$GREEN" "  $ICON_CHECK Latest code pulled successfully"
    echo

    print_color "$BLUE" "  Starting services with fresh build..."
    echo

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    # Auto-build and start
    $compose_cmd up --build -d

    echo
    print_color "$GREEN" "  $ICON_CHECK Services updated and restarted!"

    # Wait for health checks
    wait_for_services
}

wait_for_services() {
    echo
    print_color "$BLUE" "  $ICON_HEALTH Waiting for services to be healthy..."

    local timeout=120
    local elapsed=0
    local interval=5

    while [ $elapsed -lt $timeout ]; do
        local all_healthy=true

        # Check each service
        for service in postgres weaviate embedding-service backend; do
            local status
            status=$(docker compose ps --format json 2>/dev/null | grep -o "\"$service\"[^}]*\"Health\":\"[^\"]*\"" | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

            if [ "$status" != "healthy" ] && [ "$status" != "" ]; then
                all_healthy=false
            fi
        done

        if [ "$all_healthy" = true ]; then
            print_color "$GREEN" "  $ICON_CHECK All services are healthy!"
            return 0
        fi

        printf "\r  Waiting... (%ds / %ds)" "$elapsed" "$timeout"
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    echo
    print_color "$YELLOW" "  $ICON_WARN Some services may still be starting. Check status with: docker compose ps"
}

stop_services() {
    print_header "$ICON_STOP Stopping Services"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    print_color "$BLUE" "  Stopping all services..."
    $compose_cmd down

    print_color "$GREEN" "  $ICON_CHECK All services stopped"
}

restart_services() {
    print_header "$ICON_ROCKET Restarting Services"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    print_color "$BLUE" "  Restarting all services..."
    $compose_cmd restart

    print_color "$GREEN" "  $ICON_CHECK Services restarted"
    wait_for_services
}

show_status() {
    print_header "$ICON_HEALTH Service Status"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    $compose_cmd ps

    echo
    print_color "$CYAN" "  ${BOLD}Access URLs:${NC}"
    echo "    • Frontend:    http://localhost:5173"
    echo "    • Backend API: http://localhost:3000"
    echo "    • Weaviate:    http://localhost:8080"
    echo "    • PostgreSQL:  localhost:5432"
}

show_logs() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    echo
    print_color "$CYAN" "  Select service to view logs:"
    echo "    1) All services"
    echo "    2) Backend"
    echo "    3) Frontend"
    echo "    4) PostgreSQL"
    echo "    5) Weaviate"
    echo "    6) Embedding Service"
    echo "    7) Back to menu"
    echo

    read -r -p "  Enter choice [1-7]: " choice

    case $choice in
        1) $compose_cmd logs -f ;;
        2) $compose_cmd logs -f backend ;;
        3) $compose_cmd logs -f frontend ;;
        4) $compose_cmd logs -f postgres ;;
        5) $compose_cmd logs -f weaviate ;;
        6) $compose_cmd logs -f embedding-service ;;
        7) return ;;
        *) print_color "$RED" "Invalid choice" ;;
    esac
}

clean_all() {
    print_header "$ICON_CLEAN Clean Up"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    print_color "$YELLOW" "  $ICON_WARN This will remove all containers, volumes, and data!"
    echo

    if ! prompt_yn "  Are you sure you want to proceed?" "n"; then
        print_color "$BLUE" "  Cancelled."
        return
    fi

    echo
    print_color "$BLUE" "  Stopping and removing containers..."
    $compose_cmd down -v --remove-orphans

    if prompt_yn "  Also remove Docker images?" "n"; then
        print_color "$BLUE" "  Removing images..."
        $compose_cmd down --rmi local
    fi

    print_color "$GREEN" "  $ICON_CHECK Cleanup complete"
}

# ══════════════════════════════════════════════════════════════════════════════
# INTERACTIVE MENU
# ══════════════════════════════════════════════════════════════════════════════

show_menu() {
    echo
    print_color "$CYAN" "  ╔═══════════════════════════════════════════════╗"
    print_color "$CYAN" "  ║           ${BOLD}What would you like to do?${NC}${CYAN}          ║"
    print_color "$CYAN" "  ╠═══════════════════════════════════════════════╣"
    print_color "$CYAN" "  ║                                               ║"
    print_color "$CYAN" "  ║   ${GREEN}1)${NC}${CYAN} $ICON_ROCKET Start services                      ║"
    print_color "$CYAN" "  ║   ${GREEN}2)${NC}${CYAN} $ICON_STOP Stop services                       ║"
    print_color "$CYAN" "  ║   ${GREEN}3)${NC}${CYAN} 🔄 Restart services                    ║"
    print_color "$CYAN" "  ║   ${GREEN}4)${NC}${CYAN} $ICON_HEALTH Show status                        ║"
    print_color "$CYAN" "  ║   ${GREEN}5)${NC}${CYAN} $ICON_LOG View logs                          ║"
    print_color "$CYAN" "  ║   ${GREEN}6)${NC}${CYAN} 📦 Update system                       ║"
    print_color "$CYAN" "  ║   ${GREEN}7)${NC}${CYAN} $ICON_KEY Regenerate secrets                  ║"
    print_color "$CYAN" "  ║   ${GREEN}8)${NC}${CYAN} $ICON_GEAR Re-run dependency check             ║"
    print_color "$CYAN" "  ║   ${GREEN}9)${NC}${CYAN} $ICON_CLEAN Clean up (remove all data)         ║"
    print_color "$CYAN" "  ║   ${GREEN}0)${NC}${CYAN} 🚪 Exit                                ║"
    print_color "$CYAN" "  ║                                               ║"
    print_color "$CYAN" "  ╚═══════════════════════════════════════════════╝"
    echo
}

run_interactive() {
    while true; do
        clear_and_banner
        show_menu
        read -r -p "  Enter your choice [0-9]: " choice

        case $choice in
            1)
                clear_and_banner
                start_services
                ;;
            2)
                clear_and_banner
                stop_services
                ;;
            3)
                clear_and_banner
                restart_services
                ;;
            4)
                clear_and_banner
                show_status
                ;;
            5)
                clear_and_banner
                show_logs
                ;;
            6)
                clear_and_banner
                update_system
                ;;
            7)
                clear_and_banner
                regenerate_secrets
                ;;
            8)
                clear_and_banner
                run_dependency_checks
                ;;
            9)
                clear_and_banner
                clean_all
                ;;
            0)
                echo
                print_color "$MAGENTA" "  $ICON_BRAIN Thanks for using Second Brain AI System!"
                print_color "$DIM" "  Goodbye!"
                echo
                exit 0
                ;;
            *)
                print_color "$RED" "  Invalid option. Please try again."
                ;;
        esac

        echo
        wait_for_key "  Press any key to continue..."
    done
}

# ══════════════════════════════════════════════════════════════════════════════
# QUICK START MODE
# ══════════════════════════════════════════════════════════════════════════════

quick_start() {
    print_banner

    # Run all checks and setup
    if ! run_dependency_checks; then
        exit 1
    fi

    create_env_file

    echo
    if prompt_yn "Start all services now?" "y"; then
        start_services
        show_status
    else
        print_color "$CYAN" "  You can start services later with: ./start.sh start"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND LINE INTERFACE
# ══════════════════════════════════════════════════════════════════════════════

show_help() {
    print_banner
    echo
    print_color "$CYAN" "Usage: $0 [command]"
    echo
    print_color "$BOLD" "Commands:"
    echo "  (no command)    Interactive mode with menu"
    echo "  start           Start all services"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  status          Show service status"
    echo "  logs [service]  View logs (optional: backend, frontend, postgres, weaviate)"
    echo "  setup           Run setup only (check deps, create .env)"
    echo "  update          Update system (git pull + fresh build + start)"
    echo "  clean           Stop and remove all containers and volumes"
    echo "  help            Show this help message"
    echo
    print_color "$BOLD" "Examples:"
    echo "  ./start.sh              # Interactive mode"
    echo "  ./start.sh start        # Quick start all services"
    echo "  ./start.sh update       # Update and rebuild services"
    echo "  ./start.sh logs backend # View backend logs"
    echo
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

main() {
    # Handle command line arguments
    case "${1:-}" in
        start)
            print_banner
            run_dependency_checks || exit 1
            create_env_file
            start_services
            show_status
            ;;
        stop)
            print_banner
            stop_services
            ;;
        restart)
            print_banner
            restart_services
            ;;
        status)
            print_banner
            show_status
            ;;
        update)
            print_banner
            update_system
            ;;
        logs)
            local compose_cmd
            compose_cmd=$(get_compose_cmd)
            if [ -n "${2:-}" ]; then
                $compose_cmd logs -f "$2"
            else
                $compose_cmd logs -f
            fi
            ;;
        setup)
            print_banner
            run_dependency_checks || exit 1
            create_env_file
            ;;
        clean)
            print_banner
            clean_all
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            # No arguments - run interactive mode
            print_banner

            # First time setup check
            if ! check_env_file; then
                print_color "$YELLOW" "  $ICON_INFO First time setup detected!"
                echo
                if prompt_yn "  Run quick start setup?" "y"; then
                    quick_start
                    echo
                    if prompt_yn "  Continue to interactive menu?" "y"; then
                        run_interactive
                    fi
                    exit 0
                fi
            fi

            run_dependency_checks || exit 1
            run_interactive
            ;;
        *)
            print_color "$RED" "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
