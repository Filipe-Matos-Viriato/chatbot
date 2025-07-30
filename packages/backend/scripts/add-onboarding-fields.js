const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Default Portuguese onboarding questions template
const defaultOnboardingQuestions = {
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
};

async function addOnboardingFields() {
  try {
    console.log('Starting onboarding fields migration...');

    // 1. Add fields to visitors table
    console.log('Adding onboarding fields to visitors table...');
    const { error: visitorsError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE visitors
        ADD COLUMN IF NOT EXISTS onboarding_questions JSONB,
        ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
      `
    });

    if (visitorsError) {
      console.error('Error adding fields to visitors table:', visitorsError);
      throw visitorsError;
    }
    console.log('✅ Successfully added onboarding fields to visitors table');

    // 2. Add default onboarding questions field to clients table
    console.log('Adding default_onboarding_questions field to clients table...');
    const { error: clientsError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS default_onboarding_questions JSONB;
      `
    });

    if (clientsError) {
      console.error('Error adding field to clients table:', clientsError);
      throw clientsError;
    }
    console.log('✅ Successfully added default_onboarding_questions field to clients table');

    // 3. Update existing clients with default onboarding questions
    console.log('Updating existing clients with default onboarding questions...');
    
    // First, get all existing clients
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('client_id, client_name')
      .is('default_onboarding_questions', null);

    if (fetchError) {
      console.error('Error fetching clients:', fetchError);
      throw fetchError;
    }

    if (clients && clients.length > 0) {
      console.log(`Found ${clients.length} clients to update with default onboarding questions`);
      
      for (const client of clients) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            default_onboarding_questions: defaultOnboardingQuestions,
            updated_at: new Date().toISOString()
          })
          .eq('client_id', client.client_id);

        if (updateError) {
          console.error(`Error updating client ${client.client_name}:`, updateError);
        } else {
          console.log(`✅ Updated client: ${client.client_name}`);
        }
      }
    } else {
      console.log('No clients found that need default onboarding questions');
    }

    // 4. Create indexes for better performance
    console.log('Creating indexes for onboarding fields...');
    const { error: indexError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_visitors_onboarding_completed 
        ON visitors(onboarding_completed);
        
        CREATE INDEX IF NOT EXISTS idx_visitors_client_onboarding 
        ON visitors(client_id, onboarding_completed);
      `
    });

    if (indexError) {
      console.error('Error creating indexes:', indexError);
      throw indexError;
    }
    console.log('✅ Successfully created indexes for onboarding fields');

    console.log('\n🎉 Onboarding fields migration completed successfully!');
    console.log('\nSummary:');
    console.log('- Added onboarding_questions (JSONB) to visitors table');
    console.log('- Added onboarding_completed (BOOLEAN) to visitors table');
    console.log('- Added default_onboarding_questions (JSONB) to clients table');
    console.log('- Updated existing clients with default Portuguese onboarding questions');
    console.log('- Created performance indexes');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
addOnboardingFields().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
});