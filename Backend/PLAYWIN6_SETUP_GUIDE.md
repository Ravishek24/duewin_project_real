# PlayWin6 Integration Setup Guide

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
# PlayWin6 API Configuration
PLAYWIN6_API_TOKEN=your_playwin6_api_token_here
PLAYWIN6_AES_KEY=your_32_character_aes_key_here
PLAYWIN6_AES_IV=your_16_character_aes_iv_here

# Optional Configuration (defaults provided)
PLAYWIN6_API_BASE_URL=https://playwin6.com
PLAYWIN6_CALLBACK_URL=https://your-domain.com/api/playwin6/callback
PLAYWIN6_ALLOWED_IPS=127.0.0.1,::1
```

## API Token Setup

1. **Get your API token** from PlayWin6 provider
2. **Set the environment variable**:
   ```bash
   export PLAYWIN6_API_TOKEN=your_actual_token_here
   ```
3. **Restart your application** after setting the environment variable

## AES Encryption Setup

For the `payload` parameter in Launch Game requests, you need AES-256 encryption:

1. **Generate a 32-character AES key**:
   ```bash
   openssl rand -hex 16
   ```

2. **Generate a 16-character AES IV**:
   ```bash
   openssl rand -hex 8
   ```

3. **Set the environment variables**:
   ```bash
   export PLAYWIN6_AES_KEY=your_generated_aes_key
   export PLAYWIN6_AES_IV=your_generated_aes_iv
   ```

## Troubleshooting

### Error: "Missing required configuration values: ['apiToken']"

**Solution**: Set the `PLAYWIN6_API_TOKEN` environment variable:
```bash
export PLAYWIN6_API_TOKEN=your_token_here
```

### Error: "Route.post() requires a callback function but got a [object Undefined]"

**Solution**: This was fixed by adding the missing `gameLaunch` rate limiter. Restart your application.

### Error: "AES encryption key or IV not configured"

**Solution**: Set both `PLAYWIN6_AES_KEY` and `PLAYWIN6_AES_IV` environment variables.

## Testing the Integration

1. **Health Check**:
   ```bash
   curl http://localhost:8000/api/playwin6/health
   ```

2. **Get Providers**:
   ```bash
   curl http://localhost:8000/api/playwin6/providers
   ```

3. **Get Games**:
   ```bash
   curl "http://localhost:8000/api/playwin6/games/JiliGaming?count=12&type=Slot%20Game"
   ```

## Database Setup

Run the migration to create the required tables:

```bash
# Using Sequelize CLI
npx sequelize-cli db:migrate

# Or using direct SQL
mysql -u your_user -p your_database < sql/create_playwin6_tables.sql
```

## Security Notes

- Keep your API token secure and never commit it to version control
- Use HTTPS in production for all API communications
- Configure IP whitelisting for callbacks in production
- Regularly rotate your AES keys

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure the database tables are created
4. Test with the provided Postman collection 