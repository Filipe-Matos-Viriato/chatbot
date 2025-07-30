# Manual Database Migration for Onboarding Questions Feature

Due to permissions limitations, the following SQL commands need to be executed manually in the Supabase SQL Editor:

## 1. Add Onboarding Fields to Visitors Table

```sql
ALTER TABLE visitors
ADD COLUMN IF NOT EXISTS onboarding_questions JSONB,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
```

## 2. Add Default Onboarding Questions Field to Clients Table

```sql
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS default_onboarding_questions JSONB;
```

## 3. Create Performance Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_visitors_onboarding_completed 
ON visitors(onboarding_completed);

CREATE INDEX IF NOT EXISTS idx_visitors_client_onboarding 
ON visitors(client_id, onboarding_completed);
```

## 4. Update Existing Clients with Default Onboarding Questions

```sql
UPDATE clients 
SET default_onboarding_questions = '{
  "questions": [
    {
      "id": "tipologia",
      "type": "multiple_choice",
      "question": "Que tipo de imóvel procura?",
      "options": [
        { "value": "T0", "label": "T0 - Estúdio" },
        { "value": "T1", "label": "T1 - 1 Quarto" },
        { "value": "T2", "label": "T2 - 2 Quartos" },
        { "value": "T3", "label": "T3 - 3 Quartos" },
        { "value": "T4+", "label": "T4+ - 4 ou mais Quartos" },
        { "value": "moradia", "label": "Moradia" },
        { "value": "comercial", "label": "Comercial" }
      ],
      "required": true
    },
    {
      "id": "orcamento",
      "type": "range_select",
      "question": "Qual o seu orçamento?",
      "options": [
        { "value": "<150k", "label": "Até 150.000€" },
        { "value": "150k-300k", "label": "150.000€ - 300.000€" },
        { "value": "300k-500k", "label": "300.000€ - 500.000€" },
        { "value": "500k-750k", "label": "500.000€ - 750.000€" },
        { "value": ">750k", "label": "Mais de 750.000€" }
      ],
      "required": true
    },
    {
      "id": "objetivo",
      "type": "multiple_choice",
      "question": "Qual o objetivo da compra?",
      "options": [
        { "value": "habitacao", "label": "Habitação Própria" },
        { "value": "investimento", "label": "Investimento" },
        { "value": "ambos", "label": "Ambos" }
      ],
      "required": true
    },
    {
      "id": "prazo",
      "type": "multiple_choice",
      "question": "Em que prazo pretende comprar?",
      "options": [
        { "value": "imediato", "label": "Imediatamente" },
        { "value": "3-6meses", "label": "3-6 meses" },
        { "value": "6-12meses", "label": "6-12 meses" },
        { "value": "+12meses", "label": "Mais de 12 meses" }
      ],
      "required": true
    },
    {
      "id": "localizacao",
      "type": "text_input",
      "question": "Onde prefere que seja localizado o imóvel? (Concelho, Distrito)",
      "placeholder": "Ex: Lisboa, Porto, Cascais...",
      "required": false
    },
    {
      "id": "caracteristicas",
      "type": "multiple_select",
      "question": "Que características considera importantes?",
      "options": [
        { "value": "varanda", "label": "Varanda/Terraço" },
        { "value": "garagem", "label": "Garagem" },
        { "value": "elevador", "label": "Elevador" },
        { "value": "piscina", "label": "Piscina" },
        { "value": "jardim", "label": "Jardim" },
        { "value": "vista_mar", "label": "Vista Mar" },
        { "value": "centro_cidade", "label": "Centro da Cidade" },
        { "value": "transportes", "label": "Perto de Transportes" }
      ],
      "required": false
    }
  ],
  "settings": {
    "completion_message": "Obrigado! Com base nas suas preferências, posso agora ajudá-lo a encontrar o imóvel perfeito.",
    "skip_option": "Continuar sem responder",
    "title": "Ajude-nos a encontrar o seu imóvel ideal",
    "subtitle": "Responda a algumas perguntas para recebermos recomendações personalizadas"
  }
}'::jsonb,
updated_at = now()
WHERE default_onboarding_questions IS NULL;
```

## 5. Verification Queries

After executing the above commands, verify the changes:

```sql
-- Check visitors table structure
\d visitors;

-- Check clients table structure  
\d clients;

-- Verify indexes were created
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('visitors', 'clients') 
AND indexname LIKE '%onboarding%';

-- Check that existing clients have default onboarding questions
SELECT client_id, client_name, 
       CASE WHEN default_onboarding_questions IS NOT NULL THEN 'YES' ELSE 'NO' END as has_onboarding
FROM clients;
```

---

**Note**: Execute these commands in the Supabase SQL Editor one by one and verify each step before proceeding to the next.