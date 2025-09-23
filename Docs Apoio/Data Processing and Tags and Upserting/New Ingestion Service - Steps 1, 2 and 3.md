Let’s make a new ingestion-service-pdf.js, and call it ingestion-service-pdf\_V2.js.

The “listings” table will have structured data (e.g., price, beds, amenities) and the full, unstructured listing description field.

The semantic content will be in the description column, that will be chunked and embedded.

## STEP 1\. Data Retrieval,  Chunking and Embedding

\-            **Retrieval:** You retrieve properties in batches from your Supabase table. Batching is a crucial performance optimization that reduces API calls and improves throughput. (for the initial development and testing we will select a small number of listings, so the best way is to set a variable the holds the number of listings each batch will process).

 

\-            To improve semantic search, a listing’s full description is broken down into smaller, semantically coherent "chunks." A sophisticated text splitter divides the description into manageable units, such as sentences or paragraphs.

* **Propositional Chunking:** An advanced method, propositional chunking, splits the description into individual facts or propositions. For example, the sentence "The chef’s kitchen features a custom island with Italian marble countertops and professional-grade Wolf and Sub-Zero appliances" can be broken into three distinct, atomic chunks: "The chef’s kitchen has a custom island," "The island countertops are Italian marble," and "The kitchen appliances are professional-grade Wolf and Sub-Zero." This creates highly specific units for retrieval, leading to more precise answers.  
* **Chunk Overlap:** To preserve context that might be lost at the split boundary, a small overlap (e.g., 1-2 sentences) is maintained between chunks.  
* NOTE: the chunk size and overlap are defined in the “clients” table, “chunking\_rules”column.

\-            Each of these semantically rich chunks is then converted into a numerical vector using OpenAI's text-embedding-3-small model. This model is chosen for its efficiency, cost-effectiveness, and high performance in semantic understanding, making it ideal for large-scale data ingestion. One vector is generated for each chunk of the description.

\-            We need a process for creating embeddings that capture the meaning of the listing’s structured attributes.  
o   **Action:** For each listing, create an additional  
"metadata summary" chunk. This is a natural language sentence that  
summarizes the key structured data.  
o   **Example:** "This is a 5-bedroom, 4-bathroom  
luxury home built in 2022, offering 4,500 square feet of living space and  
listed at $3,500,000."

\-            Benefit:  
By embedding this summary sentence, you create a vector that represents the  
property's core stats. This allows your RAG system to understand and compare  
concepts like "value for money," "large family home," or  
"newly built property" on a semantic level, which is impossible when

these fields are only used for metadata filtering.

 

## STEP 2\. Tag Generation & Data Enrichment \- Unified  NLP Pipeline

\-            The strategy is to use a single API call to a powerful LLM to perform the bulk of that work simultaneously.

\-            You provide the model with two key pieces of information in the prompt:

1\.       The unstructured **listing description**.

2\.   	The list of **pre-existing, authoritative tags (**factual tags: e.g., beds:4, amenity:pool). These tags are your primary, non-negotiable filters). from your Supabase database.

\-            You then instruct the model to read the description, generate a list of new tags, normalize them according to your rules, and—crucially—ensure the final list doesn't duplicate any of the authoritative tags you already provided. This consolidates the extraction, generation, and deduplication logic into one efficient step.

\-            The authoritative tags (from Supabse “listings” table) are:

o   id

o   name

o   address

o   type

o   price

o   beds

o   duplex

o   baths

o   amenities

o   listing\_status

o   current\_state

o   total\_area

o   private\_area

 

Let’s specify the details of Unified NLP Pipeline: A Single LLM Call:

**1\. The Single API Call: Anatomy of the Request**

The request to the LLM will be a single call with a structured input. It's not just a simple text prompt. It contains a few key components:

·        **System Prompt:** This sets the persona and context for the model. It's your instructions for how to behave.

·        **User Prompt:** This contains the raw, unstructured data (the property description) that the model needs to process.

·        **JSON Schema (Function Calling/Tool Use):** This is the most crucial part. You define a structured output format (a JSON schema) that the model must adhere to. This schema is the "contract" between your code and the LLM's response. It dictates the exact format for your tags, and this is where you enforce the normalization rules.

**2\. Implementing Normalization & Mapping within the Unified Prompt**

The genius of this approach is that you don't need to write separate code for dictionary lookups, semantic similarity, or regex. You embed these rules and data directly into the LLM's prompt and schema:

**A. Dictionary-Based Mapping** (defined at the end of the document)**:**

* **How to Implement:** You will encode your dictionary of canonical tags and their synonyms directly into the system prompt.  
* **Prompt Instruction:** The system prompt will explicitly state the mapping rules.  
* **Example Prompt Snippet (inside the System Prompt):**"You are a real estate data extraction agent. Your task is to analyze property descriptions and extract key features, amenities, and architectural styles. You must normalize all extracted phrases to a canonical tag format. For example, 'private swimming pool', 'infinity pool', and 'lap pool' must all be mapped to the canonical tag 'amenity:pool\_private'. 'Home theater' and 'media room' must be mapped to 'amenity:media\_room'."

**B. Semantic Similarity-Based Mapping:**

* **How to Implement:** The LLM itself, with its vast pre-training, is a powerful semantic engine. You don't need to run a separate embedding model or a cosine similarity calculation. You instruct the LLM to use its internal semantic understanding to find the best match.  
* **Prompt Instruction:** The system prompt will include a general instruction to handle nuanced phrases.  
* **Example Prompt Snippet (inside the System Prompt):**"If you encounter a phrase that is a close semantic match to one of the canonical tags, you must use that canonical tag. For instance, 'chef's kitchen with professional-grade appliances' should be mapped to 'amenity:gourmet\_kitchen' based on its meaning."

**C. Rule-Based Normalization (Regex)** (defined at the end of the document)**:**

* **How to Implement:** You describe the normalization patterns in plain language within the prompt, and the LLM's reasoning engine handles the rest.  
* **Prompt Instruction:** You provide explicit rules for common patterns, such as standardizing numeric values or specific phrase structures.  
* **Example Prompt Snippet (inside the System Prompt):**"Standardize all phrases related to bedroom and bathroom counts. For example, 'three bedrooms' should be normalized to 'bedrooms:3', and '2.5 baths' to 'bathrooms:2.5'. Ignore irrelevant punctuation."

 

**3\. The Crucial Step: Deduplication & Final Schema**

 

This is where all the logic comes together. You will define a tools or function\_call schema that forces the model to perform all the logic and deliver the output in a clean, de-duplicated format.

 

**Putting It All Together: The Complete Prompt & Process**

1. **System Prompt example:**  
* You are a real estate data extraction expert.  
* Your task is to analyze a property description and extract all relevant features, amenities, materials, brands, and architectural styles.  
* You must normalize all extracted phrases to a canonical tag format based on these rules:  
* 1\. \*\*Dictionary:\*\* The Dictionary-Based Mapping is defined at the end of the document.  
* 2\. \*\*Semantic:\*\* Use your knowledge to map similar phrases like 'chef's kitchen with professional-grade appliances' to 'amenity:gourmet\_kitchen'.  
* 3\. \*\*Regex/Rules:\*\* An extensive list of Rule-Based Normalization (Regex) for real estate amenities and other key features is provided at the end of the document  
* 4\. \*\*Deduplication:\*\* The final output list of 'generated\_tags' must be entirely new and must not contain any tags from the provided list of pre-existing authoritative tags. This is a critical step to avoid redundancy. The authoritative tags are defined in the in the beginning of step 2 of this document  
* 5\. \*\*Output Format:\*\* You must respond with a JSON object that adheres strictly to the provided schema.

2\.                      **User Prompt generic example:**

* Property Description: "This stunning Tuscan villa features a grand entrance with hand-painted frescoes and a spacious gourmet kitchen with high-end appliances. The exterior boasts a private infinity pool and meticulously landscaped gardens."  
* Pre-existing Authoritative Tags: \["property\_type:villa", "neighborhood:tuscan\_hills", "bedrooms:4", "bathrooms:3.5", "price:5500000"\]

3\.                      **LLM Response (adheres to the schema):**  
 JSON  
 {  
   "generated\_tags": \[  
     "architectural\_style:tuscan\_villa",  
     "feature:hand\_painted\_frescoes",  
     "amenity:gourmet\_kitchen",  
     "amenity:pool\_private",  
     "feature:landscaped\_gardens"  
   \],  
   "extracted\_features": {  
     "bedrooms": null, // Not found in this chunk  
     "bathrooms": null  
   }  
 }

 **Final Accomplishment:** By carefully crafting the prompt and schema, you've accomplished all the original goals in a single, efficient step. The LLM handles the extraction, the various normalization techniques, and the final deduplication, all before sending a single, structured payload back to your application. This is a powerful shift from a complex, multi-stage pipeline to a single, highly performant API call.

 

**Dictionary-based mapping \- PT**

A seguir, está o mapeamento extenso baseado em dicionário para imóveis, incluindo termos gerais e de luxo, traduzido para o português de Portugal. Este dicionário tem como objetivo normalizar frases de texto não estruturado (como a descrição de um imóvel) para uma tag canónica consistente. O formato é etiqueta\_canónica: \[lista de frases originais\].

---

**Comodidades**

* comodidade:piscina\_privada: \["piscina privada", "piscina infinita", "piscina estreita", "piscina gruta", "piscina de imersão", "piscina iluminada pelo sol", "piscina cintilante"\]  
* comodidade:jacuzzi: \["jacuzzi", "banheira de hidromassagem", "spa", "hidromassagem"\]  
* comodidade:sala\_de\_cinema: \["sala de cinema", "cinema em casa", "sala de projeção", "cinema privado"\]  
* comodidade:ginasio: \["ginásio em casa", "sala de fitness", "ginásio privado", "estúdio de fitness", "sala de exercício"\]  
* comodidade:garrafeira: \["garrafeira", "adega", "sala de vinhos", "coleção de vinhos", "adega de sommelier"\]  
* comodidade:cozinha\_gourmet: \["cozinha gourmet", "cozinha de chef", "cozinha com eletrodomésticos de alta gama", "cozinha profissional", "cozinha culinária"\]  
* comodidade:cozinha\_exterior: \["cozinha exterior", "churrasqueira", "área de churrasco"\]  
* comodidade:campo\_desportivo: \["campo de ténis", "campo de basquetebol", "campo de pickleball", "campo desportivo"\]  
* comodidade:elevador: \["elevador privado", "elevador residencial"\]  
* comodidade:casa\_inteligente: \["casa inteligente", "casa automatizada", "sistema inteligente integrado"\]  
* comodidade:vinha: \["vinha", "adega", "quinta com vinhas"\]  
* comodidade:a\_beira\_da \_água: \["à beira-mar", "à beira do lago", "na linha da frente do oceano", "junto ao rio", "na praia"\]  
* comodidade:jardim: \["jardim paisagístico", "terrenos cuidados", "jardim zen", "pátio interior"\]  
* comodidade:garagem: \["garagem para dois carros", "garagem para três carros", "garagem grande", "garagem espaçosa"\]  
* comodidade:patio: \["pátio", "deck", "terraço", "varanda", "alpendre"\]  
* comodidade:lareira: \["lareira", "lareira a lenha", "lareira a gás", "lareira dupla face", "lareira acolhedora", “recuperador de calor”, “pellets”\]

---

**Características e Materiais**

* caracteristica:espaco\_aberto: \["espaço em conceito aberto", "layout fluído", "planta de piso aberto", "espaço aberto e arejado"\]  
* caracteristica:pe\_direito\_alto: \["pé-direito alto", "tetos abobadados", "tetos com vigas", "tetos com altura dupla"\]  
* caracteristica:janelas\_do\_chao\_ao\_teto: \["janelas do chão ao teto", "janelões", "parede de vidro"\]  
* caracteristica:feita\_a\_medida: \["feita à medida", "personalizada", "desenhada à medida", "única", "trabalho artesanal"\]  
* material:marmore: \["bancadas de mármore", "chão de mármore", "mármore carrara", "mármore calacatta", "mármore estatuário"\]  
* material:madeira: \["chão de madeira", "pavimento de madeira", "chão de mogno rico", "madeira reluzente"\]  
* material:granito: \["bancadas de granito", "laje de granito"\]  
* material:quartzo: \["bancadas de quartzo", "pedra de quartzo"\]

---

**Estilos Arquitetónicos**

* estilo:seculo\_meio\_moderno: \["meio do século moderno", "design do meio do século"\]  
* estilo:contemporaneo: \["contemporâneo", "minimalista moderno", "contemporâneo elegante", "design de vanguarda"\]  
* estilo:vitoriano: \["vitoriano", "casa da era vitoriana", "arquitetura vitoriana", "estilo rainha ana"\]  
* estilo:casa\_de\_campo: \["casa de campo", "casa de campo moderna", "casa de campo rústica"\]  
* estilo:colonial: \["colonial", "revivalismo colonial"\]  
* estilo:mediterranico: \["mediterrânico", "vila mediterranica"\]  
* estilo:artesao: \["artesão", "estilo artesão"\]

---

**Tipos e Descrições de Imóveis**

* tipo:moradia: \["moradia", "casa unifamiliar", "residência"\]  
* tipo:apartamento: \["apartamento", "condomínio", "flat"\]  
* tipo:moradia\_geminada: \["moradia geminada", "casa em banda", “moradia em banda”\]  
* tipo:imovel\_de\_luxo: \["imóvel de luxo", "propriedade exclusiva", "mansão", "castelo", "quinta"\]  
* desc:pronto\_a\_habitar: \["pronto a habitar", "pronto para entrar", "recém-renovado", "totalmente atualizado"\]  
* desc:vistas: \["vistas panorâmicas", "vistas para a cidade", "vistas para o oceano", "vistas para a montanha", "paisagem cénica", "vistas deslumbrantes"\]  
* desc:condominio\_fechado: \["condomínio fechado", "entrada fechada", "propriedade fechada e segura"\]

---

**Localização e Contexto**

* localizacao:centro\_cidade: \["centro da cidade", "coração da cidade", "zona urbana"\]  
* localizacao:beco\_sem\_saida: \["beco sem saída", "rua sem saída"\]  
* localizacao:acessivel\_a\_pe: \["bairro acessível a pé", "perto de comodidades", "localização conveniente"\]

localizacao:a\_beira\_da\_agua: \["à beira-mar", "à beira do lago", "na linha da frente do oceano", "junto ao rio", "na praia"\]

 

 

**Rule Based Normalization \- PT**

A seguir, está uma lista de regras de normalização baseadas em expressões regulares (Regex) para características de imóveis, adaptadas para o português de Portugal.

**Tamanho e Contagem**

* tamanho:m2:\<numero\>: Para extrair a área em metros quadrados.  
  * \\b(\\d{3,4}(?:,\\d{3})?)\\s\*m2\\b: Corresponde a números como "1500 m2" ou "2.500 m2".  
  * \\b(\\d{3,4}(?:,\\d{3})?)\\s\*metros\\s\*quadrados\\b: Corresponde a "2000 metros quadrados".  
* tamanho:ha:\<numero\>: Para extrair o tamanho do lote em hectares.  
  * \\b(\\d+(?:,\\d+)?)\\s\*hectare(?:s)?\\b: Corresponde a "5 hectares" ou "2,5 hectare".  
* tamanho:andares:\<numero\>: Para capturar o número de andares.  
  * \\b(um|dois|três|quatro|cinco|1|2|3|4|5)\\-? (?:andares|pisos|pisos)\\b: Corresponde a frases como "dois andares" ou "3 pisos".  
* Block/Fraction: /bloco\\s\*(\\w+)/i, /fraç(?:ão|ao)\\s\*(\[a-z\])/i

---

**Comodidades e Características**

* comodidade:piscina: Para variações de "piscina".  
  * \\b(?:piscina|piscina\\s\*privada|piscina\\s\*infinita|piscina\\s\*aquecida|piscina\\s\*interior|piscina\\s\*exterior)\\b: Corresponde a "piscina privada" ou "piscina aquecida".  
* comodidade:garagem: Para diferentes tamanhos e descrições de garagem.  
  * \\b(uma|duas|três|quatro|1|2|3|4)\\-? lugar(?:es)?\\s\*(?:de\\s\*garagem|de\\s\*estacionamento)\\b: Corresponde a "dois lugares de garagem" ou "4 lugares de estacionamento".  
  * \\bgaragem(?:s)?\\b|\\bbox\\s\*de\\s\*garagem\\b: Corresponde a "garagem" ou "box de garagem".  
* comodidade:lareira: Para diferentes tipos de lareiras.  
  * \\b(?:lareira|recuperador\\s\*de\\s\*calor|lareira\\s\*com\\s\*recuperador)\\b: Corresponde a "lareira" ou "recuperador de calor".  
* comodidade:elevador: Para elevadores.  
  * \\b(?:elevador|elevador\\s\*privado)\\b: Corresponde a "elevador" ou "elevador privado".  
* comodidade:ar\_condicionado: Para sistemas de ar condicionado.  
  * \\b(?:ar\\s\*condicionado|AC|A/C|climatizaçao)\\b: Corresponde a "ar condicionado" ou "A/C".  
* comodidade:vistas: Para vários tipos de vistas.  
  * \\b(?:vistas|vista)\\s\*(?:panorâmica(?:s)?|desafogada(?:s)?|deslumbrante(?:s)?|para\\s\*o\\s\*mar|para\\s\*a\\s\*serra|para\\s\*a\\s\*cidade)\\b: Corresponde a "vista panorâmica" ou "vistas para a serra".  
* comodidade:espaço\_exterior: Para áreas externas.  
  * \\b(?:jardim|logradouro|pátio|terraço|varanda|deck)\\b: Corresponde a "jardim" ou "varanda".  
* comodidade:arrumos: Para soluções de arrumação.  
  * \\b(?:arrumos|despensa|sótão|cave)\\b: Corresponde a "arrumos" ou "cave".  
* caracteristica:eficiencia\_energetica: Para características de poupança de energia.  
  * \\b(?:eficiência\\s\*energética|painéis\\s\*solares|certificação\\s\*energética\\s\*A)\\b: Corresponde a "painéis solares" ou "certificação energética A".

---

**Estado e Condição**

* estado:renovado: Para imóveis em boas condições.  
  * \\b(?:novo|recém-renovado|reabilitado|remodelado)\\b|\\b(pronto a\\s\*habitar)\\b: Corresponde a "recém-renovado" ou "pronto a habitar".  
* estado:precisa\_obras: Para imóveis que precisam de trabalho.  
  * \\b(?:para\\s\*obras|para\\s\*remodelar|precisa\\s\*de\\s\*intervenção)\\b: Corresponde a "para obras" ou "precisa de intervenção".

---

**Acesso e Localização**

* acesso:privado: Para características privadas.  
  * \\b(?:acesso|entrada|rua|portão)\\s\*privado\\b: Corresponde a "acesso privado" ou "rua privada".  
* comunidade:condominio\_fechado: Para identificar condomínios fechados.  
  * \\bcondomínio\\s\*fechado\\b: Corresponde a "condomínio fechado".

 

 

## Step 3: The Upserting & Indexing Process

Now that you have all the necessary components—the chunked descriptions, their embeddings, and the structured metadata and tags—you will populate your Pinecone index.

There will be a pinecone namespace for each client. The name of the namespace is the “client_id” front the “clients” table.

* **Vector Construction:** For each **chunk** of a property description, you will create a single vector object to be sent to Pinecone. This object is the heart of your searchable index. It will consist of:  
1. **id**: A unique identifier for the chunk. A good practice is to combine the client\_id, the listing\_id with a chunk number (e.g., 12345-chunk-1). This ensures each chunk is individually addressable.  
2. **values**: The vector embedding you generated for this specific chunk using OpenAI's model.  
3. **metadata**: This is where you store a comprehensive JSON object.5 This metadata is essential for filtering and is the key to your hybrid search. It should include:

* The original text of the chunk itself. Storing the chunk\_text in the metadata is crucial for one reason: it's what the LLM will see. Pinecone's query result returns the metadata, so your application can pass the exact text of the relevant chunk directly to the LLM without having to do another lookup. This is a fundamental part of the RAG pattern and should be explicitly highlighted as the source of truth for the LLM's context.  
* All relevant structured data from Supabase (listing id, price, beds, baths, etc.).  
* The list of intelligent, generated tags for the full property.  
* the "metadata" field can also be used for **re-ranking**. For example, your application could retrieve 50 chunks, and then use a small, fast re-ranking model (or even a simple keyword-based score) to find the absolute best 3-5 chunks to send to the LLM, placing the most relevant ones at the beginning of the prompt.

* **Batch Upserting to Pinecone:** To ensure maximum efficiency and performance, you will upsert these vector objects in large batches (e.g., 100 to 1,000 vectors at a time).6 This is a standard and highly optimized process that is built into the Pinecone client.

* **Continuous Synchronization:** Your most robust pipeline will use a webhook from Supabase to trigger this upsert process. Whenever a property listing is added, updated, or removed in your Supabase database, an event is fired. This event triggers your upserting script, ensuring that your Pinecone index is always a fresh and accurate reflection of your live listings.

**Webhook Limitations:** Supabase webhooks are a "fire-and-forget" mechanism. They are great for real-time updates but can have limitations. What if the webhook payload fails to deliver due to a network issue? What if the upserting script goes down? The system would fall out of sync.

**Recommended Alternatives/Improvements:**

1. **Periodic Batch Upserts:** The most common production strategy is a combination of real-time webhooks and a periodic (e.g., nightly) full or partial batch upsert. The nightly job acts as a backstop, ensuring that any missed changes are captured and that the index remains synchronized.  
2. **Queueing System (this is the chosen one):** A more robust design would be for the Supabase webhook to not directly trigger the upsert, but rather to send a message to a reliable message queue (like AWS SQS, RabbitMQ, or a simple database table). A separate worker process would then consume messages from the queue and perform the upsert. This guarantees that every change is eventually processed, even if the upserting service has a temporary issue. This pattern is essential for high-availability systems.

 

When a listing has no description, it means there is **no semantic content** to vectorize. 

So, how do you handle it? You still have to create a vector.

One strategy would be to create a special "dummy" vector.

This is a standard and acceptable workaround, but it's important to recognize its limitations and offer a more advanced alternative.

* **Critique:** While a dummy vector allows for metadata filtering, it does not solve the user's intent. If a user asks "What are the cheapest homes with a gourmet kitchen?", the system won't semantically match with the "dummy" vector, so it will miss a structured-only listing that has price and a gourmet\_kitchen tag. The dummy vector works for "What are the cheapest homes?", but it's not a universal solution for all hybrid queries.  
* **Advanced Alternative (Hybrid Indexing):** A more recent and sophisticated approach is to **vectorize the structured data itself**. This is done by creating a natural language sentence from the structured data.  
  * **Example:** For a listing with price: 1.2M, bedrooms: 3, bathrooms: 2, and a pool, you could generate the sentence: "This property has a price of 1.2 million dollars, 3 bedrooms, 2 bathrooms, and features a pool."  
  * **Process:** You would embed this sentence and use it as the vector for the listing. This allows a user to ask a semantic query like, "Show me an affordable home with a decent number of bedrooms," and the vector search can now match listings that only have structured data. This makes your system far more powerful and removes the need for a dummy vector. Adding a flag like "has\_description": false is a best practice. It allows you to explicitly filter out these properties

 

 

 

