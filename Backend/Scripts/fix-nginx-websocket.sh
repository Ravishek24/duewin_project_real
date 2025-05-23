#!/bin/bash
# NGINX WebSocket Configuration Helper
# This script checks and optionally fixes NGINX configuration for WebSocket support
# Run with sudo: sudo ./fix-nginx-websocket.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}===== NGINX WEBSOCKET CONFIGURATION HELPER =====${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

# Common NGINX config locations
CONFIG_LOCATIONS=(
  "/etc/nginx/sites-enabled/default"
  "/etc/nginx/sites-enabled/strike.atsproduct.in"
  "/etc/nginx/sites-available/default"
  "/etc/nginx/sites-available/strike.atsproduct.in"
  "/etc/nginx/conf.d/default.conf"
  "/etc/nginx/nginx.conf"
)

# Find the first existing config file
CONFIG_FILE=""
for loc in "${CONFIG_LOCATIONS[@]}"; do
  if [ -f "$loc" ]; then
    CONFIG_FILE="$loc"
    break
  fi
done

if [ -z "$CONFIG_FILE" ]; then
  echo -e "${RED}Could not find NGINX configuration file.${NC}"
  echo -e "Please enter the path to your NGINX configuration:"
  read -r CONFIG_FILE
  
  if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}File not found. Exiting.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Found NGINX configuration at:${NC} $CONFIG_FILE"

# Check current configuration
echo -e "\n${GREEN}Checking current configuration...${NC}"

# Check for WebSocket headers
WS_UPGRADE=$(grep -c "proxy_set_header[[:space:]]\+Upgrade" "$CONFIG_FILE")
WS_CONNECTION=$(grep -c "proxy_set_header[[:space:]]\+Connection[[:space:]]\+\"upgrade\"" "$CONFIG_FILE")
HTTP_VERSION=$(grep -c "proxy_http_version[[:space:]]\+1.1" "$CONFIG_FILE")
READ_TIMEOUT=$(grep -c "proxy_read_timeout" "$CONFIG_FILE")

# Check for proxy_pass to WebSocket
HAS_PROXY_PASS=$(grep -c "proxy_pass" "$CONFIG_FILE")

# Display status
echo -e "\nWebSocket configuration status:"
if [ "$WS_UPGRADE" -gt 0 ]; then
  echo -e "${GREEN}✅ Upgrade header:${NC} Found"
else
  echo -e "${RED}❌ Upgrade header:${NC} Missing"
fi

if [ "$WS_CONNECTION" -gt 0 ]; then
  echo -e "${GREEN}✅ Connection header:${NC} Found"
else
  echo -e "${RED}❌ Connection header:${NC} Missing"
fi

if [ "$HTTP_VERSION" -gt 0 ]; then
  echo -e "${GREEN}✅ HTTP version 1.1:${NC} Found"
else
  echo -e "${RED}❌ HTTP version 1.1:${NC} Missing"
fi

if [ "$READ_TIMEOUT" -gt 0 ]; then
  echo -e "${GREEN}✅ Read timeout:${NC} Found"
else
  echo -e "${YELLOW}⚠️ Read timeout:${NC} Not specified (using default)"
fi

echo -e "\nFound $HAS_PROXY_PASS proxy_pass directive(s)"

# Ask if user wants to fix configuration
if [ "$WS_UPGRADE" -eq 0 ] || [ "$WS_CONNECTION" -eq 0 ] || [ "$HTTP_VERSION" -eq 0 ]; then
  echo -e "\n${YELLOW}WebSocket configuration is incomplete.${NC}"
  echo -e "Would you like to add the missing WebSocket configuration? (y/n)"
  read -r FIX_CONFIG
  
  if [[ "$FIX_CONFIG" =~ ^[Yy]$ ]]; then
    # Backup original config
    BACKUP_FILE="$CONFIG_FILE.bak.$(date +%s)"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}Created backup at:${NC} $BACKUP_FILE"
    
    # Find the location(s) to insert WebSocket config
    LOCATIONS=$(grep -n "location" "$CONFIG_FILE" | grep -v "#")
    
    echo -e "\nFound these location blocks:"
    echo "$LOCATIONS"
    
    echo -e "\n${YELLOW}Enter the line number of the location block to modify:${NC}"
    read -r LINE_NUMBER
    
    # Extract a few lines after the selected location
    LOCATION_CONTEXT=$(tail -n +$LINE_NUMBER "$CONFIG_FILE" | head -n 10)
    echo -e "\nSelected location context:\n$LOCATION_CONTEXT"
    
    echo -e "\n${YELLOW}Confirm this is the correct location block? (y/n)${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      # Find the closing brace line number
      BLOCK_START=$LINE_NUMBER
      BLOCK_END=$(tail -n +$BLOCK_START "$CONFIG_FILE" | grep -n "}" | head -1 | cut -d: -f1)
      BLOCK_END=$((BLOCK_START + BLOCK_END - 1))
      
      # WebSocket configuration to add
      WS_CONFIG="\n        # WebSocket support\n"
      
      if [ "$HTTP_VERSION" -eq 0 ]; then
        WS_CONFIG="${WS_CONFIG}        proxy_http_version 1.1;\n"
      fi
      
      if [ "$WS_UPGRADE" -eq 0 ]; then
        WS_CONFIG="${WS_CONFIG}        proxy_set_header Upgrade \$http_upgrade;\n"
      fi
      
      if [ "$WS_CONNECTION" -eq 0 ]; then
        WS_CONFIG="${WS_CONFIG}        proxy_set_header Connection \"upgrade\";\n"
      fi
      
      if [ "$READ_TIMEOUT" -eq 0 ]; then
        WS_CONFIG="${WS_CONFIG}        proxy_read_timeout 60s;\n"
      fi
      
      # Insert configuration
      INSERT_POINT=$((BLOCK_END - 1))
      awk -v line="$INSERT_POINT" -v config="$WS_CONFIG" \
        'NR==line{print config}1' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
      
      mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
      
      echo -e "${GREEN}WebSocket configuration added to NGINX config.${NC}"
      
      # Test NGINX configuration
      echo -e "\n${YELLOW}Testing NGINX configuration...${NC}"
      if nginx -t; then
        echo -e "${GREEN}NGINX configuration test successful.${NC}"
        
        echo -e "\n${YELLOW}Would you like to restart NGINX to apply changes? (y/n)${NC}"
        read -r RESTART_NGINX
        
        if [[ "$RESTART_NGINX" =~ ^[Yy]$ ]]; then
          systemctl restart nginx
          echo -e "${GREEN}NGINX restarted successfully.${NC}"
        else
          echo -e "${YELLOW}Remember to restart NGINX manually:${NC} sudo systemctl restart nginx"
        fi
      else
        echo -e "${RED}NGINX configuration test failed.${NC}"
        echo -e "Restoring backup..."
        cp "$BACKUP_FILE" "$CONFIG_FILE"
        echo -e "${GREEN}Backup restored.${NC}"
      fi
    else
      echo -e "${YELLOW}Operation cancelled.${NC}"
    fi
  else
    echo -e "${YELLOW}No changes made to NGINX configuration.${NC}"
  fi
else
  echo -e "\n${GREEN}NGINX appears to be correctly configured for WebSockets.${NC}"
fi

echo -e "\n${GREEN}===== TIPS FOR WEBSOCKET TROUBLESHOOTING =====${NC}"
echo -e "1. If you're still having issues, check these:"
echo -e "   - Firewall settings (ports 80/443 and WebSocket port if different)"
echo -e "   - SSL certificate validity"
echo -e "   - DNS settings for your domain"
echo -e "2. Test WebSocket connectivity using online tools:"
echo -e "   - https://www.piesocket.com/websocket-tester"
echo -e "   - https://websocketking.com/"
echo -e "3. Check NGINX logs for specific errors:"
echo -e "   - tail -f /var/log/nginx/error.log"
echo -e "   - tail -f /var/log/nginx/access.log"

echo -e "\n${GREEN}WebSocket configuration check complete.${NC}" 