# Sytem DARK - Pair Code prioritário

O bot está configurado para priorizar conexão por código.

## .env

```env
BOT_NUMBER=244949926074
PAIRING_NUMBER=244949926074
PAIRING_CODE=true
USE_QR=false
PAIRING_ATTEMPTS=3
PAIRING_RETRY_MS=15000
CONNECT_TIMEOUT_MS=180000
DEFAULT_QUERY_TIMEOUT_MS=90000
```

## Como conectar

1. Inicie o servidor com:

```bash
node index.js
```

2. Nos logs aparecerá:

```txt
SYTEM DARK - PAIR CODE
Número do bot: +244949926074
Código: XXXX-XXXX
```

3. No WhatsApp do número +244949926074:

```txt
Aparelhos conectados > Conectar aparelho > Conectar com número
```

4. Digite o código exibido nos logs.

## Observação

O WhatsApp não permite que um bot envie uma mensagem para o próprio número antes de estar conectado. Por isso o aviso aparece nos logs do servidor. Depois que conectar, o bot envia uma mensagem de confirmação ao dono.
