# Transcricoes reais da API REST

Capturado contra a API em execucao (`http://localhost:3000`) em 2026-09-19T13:37:26-03:00.

Nas transcricoes, `$API_KEY` substitui a chave real e `$D1`/`$D2` sao amanha e depois de amanha (as datas que o seed popula). Todos os pacientes sao os ficticios do seed.

```bash
BASE_URL=http://localhost:3000
D1=2026-09-20
D2=2026-09-21
```

## Autenticacao

### Health check (rota publica, dispensa API key)

```bash
curl -s -i -X GET "$BASE_URL/health"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 15

{
  "status": "ok"
}
```

### Rota protegida sem API key retorna 401

```bash
curl -s -i -X GET "$BASE_URL/doctors"
```

```http
HTTP/1.1 401 Unauthorized
content-type: application/json; charset=utf-8
content-length: 63

{
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

## Consulta de agenda e dados de apoio

### Lista de medicos

```bash
curl -s -i -X GET "$BASE_URL/doctors" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 124

[
  {
    "id": 1,
    "name": "Dra. Carla Mendes",
    "specialty": "cardiologia"
  },
  {
    "id": 2,
    "name": "Dr. Diego Alves",
    "specialty": "dermatologia"
  }
]
```

### Horarios disponiveis em D1

```bash
curl -s -i -X GET "$BASE_URL/availability?date=$D1" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 140

[
  {
    "id": 1,
    "doctorId": 1,
    "doctorName": "Dra. Carla Mendes",
    "specialty": "cardiologia",
    "date": "2026-09-20",
    "startTime": "09:00",
    "endTime": "09:30"
  }
]
```

### Horarios disponiveis em D2, filtrando por especialidade

A especialidade e comparada sem diferenciar maiusculas nem acentos, porque o paciente digita como fala (`Dermatologia`, `dermatologia`, `DERMATOLOGIA` levam todos ao mesmo medico).

```bash
curl -s -i -X GET "$BASE_URL/availability?date=$D2&specialty=Dermatologia" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 139

[
  {
    "id": 3,
    "doctorId": 2,
    "doctorName": "Dr. Diego Alves",
    "specialty": "dermatologia",
    "date": "2026-09-21",
    "startTime": "14:00",
    "endTime": "14:30"
  }
]
```

### Identificacao do paciente por e-mail

```bash
curl -s -i -X GET "$BASE_URL/patients/lookup?email=ana.souza@example.com" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 84

{
  "id": 1,
  "name": "Ana Souza",
  "email": "ana.souza@example.com",
  "phone": "+5511900000001"
}
```

### Valores e formas de pagamento

```bash
curl -s -i -X GET "$BASE_URL/payments" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 195

[
  {
    "id": 1,
    "consultationType": "consultation",
    "price": 250,
    "paymentMethods": [
      "pix",
      "credit_card",
      "boleto"
    ]
  },
  {
    "id": 2,
    "consultationType": "follow_up",
    "price": 150,
    "paymentMethods": [
      "pix",
      "credit_card"
    ]
  }
]
```

## POST /appointments/by-details

Este endpoint existe para que o agente de IA nunca precise guardar um `slotId` opaco entre duas chamadas: ele repete medico, data e horario como apareceram na conversa e o servidor resolve o slot real.

### Agendamento por nome do medico, data e horario

```bash
curl -s -i -X POST "$BASE_URL/appointments/by-details" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1, "doctorName": "Dr. Diego Alves", "date": "$D2", "startTime": "14:00"}'
```

```http
HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
content-length: 221

{
  "id": 10,
  "patientId": 1,
  "slotId": 3,
  "status": "active",
  "createdAt": "2026-09-19 16:37:26",
  "cancelledAt": null,
  "doctorName": "Dr. Diego Alves",
  "specialty": "dermatologia",
  "date": "2026-09-21",
  "startTime": "14:00",
  "endTime": "14:30"
}
```

### O mesmo horario, ja ocupado, nao pode ser agendado de novo

```bash
curl -s -i -X POST "$BASE_URL/appointments/by-details" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1, "doctorName": "Dr. Diego Alves", "date": "$D2", "startTime": "14:00"}'
```

```http
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
content-length: 87

{
  "error": "SLOT_NOT_FOUND",
  "message": "Slot not found: Dr. Diego Alves 2026-09-21 14:00"
}
```

### Nome de medico inexistente

```bash
curl -s -i -X POST "$BASE_URL/appointments/by-details" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1, "doctorName": "Dra. Ninguem", "date": "$D2", "startTime": "14:00"}'
```

```http
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
content-length: 71

{
  "error": "DOCTOR_NOT_FOUND",
  "message": "Doctor not found: Dra. Ninguem"
}
```

### Corpo sem `doctorName` nem `specialty` e rejeitado pelo schema

```bash
curl -s -i -X POST "$BASE_URL/appointments/by-details" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1, "date": "$D2", "startTime": "14:00"}'
```

```http
HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
content-length: 61

{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data"
}
```

## Consulta do agendamento criado

### Leitura do agendamento por id

```bash
curl -s -i -X GET "$BASE_URL/appointments/10" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 221

{
  "id": 10,
  "patientId": 1,
  "slotId": 3,
  "status": "active",
  "createdAt": "2026-09-19 16:37:26",
  "cancelledAt": null,
  "doctorName": "Dr. Diego Alves",
  "specialty": "dermatologia",
  "date": "2026-09-21",
  "startTime": "14:00",
  "endTime": "14:30"
}
```

## POST /appointments/cancel-by-patient

### Cancelamento da consulta ativa do paciente

```bash
curl -s -i -X POST "$BASE_URL/appointments/cancel-by-patient" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1}'
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 241

{
  "id": 10,
  "patientId": 1,
  "slotId": 3,
  "status": "cancelled",
  "createdAt": "2026-09-19 16:37:26",
  "cancelledAt": "2026-09-19 16:37:26",
  "doctorName": "Dr. Diego Alves",
  "specialty": "dermatologia",
  "date": "2026-09-21",
  "startTime": "14:00",
  "endTime": "14:30"
}
```

### Novo cancelamento sem consulta ativa retorna 404

```bash
curl -s -i -X POST "$BASE_URL/appointments/cancel-by-patient" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1}'
```

```http
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
content-length: 78

{
  "error": "APPOINTMENT_NOT_FOUND",
  "message": "Appointment not found: patient 1"
}
```

### O horario cancelado volta a aparecer como disponivel

```bash
curl -s -i -X GET "$BASE_URL/availability?date=$D2" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 139

[
  {
    "id": 3,
    "doctorId": 2,
    "doctorName": "Dr. Diego Alves",
    "specialty": "dermatologia",
    "date": "2026-09-21",
    "startTime": "14:00",
    "endTime": "14:30"
  }
]
```

## Validacao e superficie de ataque

### E-mail com formato de SQL injection e tratado como valor literal

```bash
curl -s -i -X GET "$BASE_URL/patients/lookup?email=%27%20OR%201%3D1%20--%40example.com" \
  -H "x-api-key: $API_KEY"
```

```http
HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
content-length: 61

{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data"
}
```

### Campo desconhecido no corpo e rejeitado (schemas Zod `.strict()`)

```bash
curl -s -i -X POST "$BASE_URL/appointments" \
  -H "x-api-key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"patientId": 1, "slotId": 1, "isAdmin": true}'
```

```http
HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
content-length: 61

{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data"
}
```

