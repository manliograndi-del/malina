/*
 * Compilatutto – i dati di una famiglia e le parole con cui i moduli li chiamano.
 *
 * Ogni campo ha:
 *   k     chiave interna
 *   e     etichetta mostrata nell'app
 *   g     gruppo nella scheda della persona (assente per i valori calcolati)
 *   es    esempio mostrato nel campo vuoto
 *   seg   segnaposto standard per lettere e documenti, es. [NOME PADRE]
 *   sin   parole o frasi che, trovate nell'etichetta di un campo, lo identificano
 *   escl  parole che, se presenti, escludono il campo
 *   tipo  data | sesso | prov | cf | email | tel | cap | scelta | doc
 *   org   il dato riguarda un ente (scuola, banca, datore di lavoro)
 *   calc  valore ricavato dagli altri dati
 *   doc   vale solo per lettere e documenti
 */
const CT = {
  versione: 2,

  relazioni: [
    { r: 'io', e: 'Io', breve: 'io' },
    { r: 'coniuge', e: 'Marito o moglie', breve: 'coniuge' },
    { r: 'figlio', e: 'Figlio o figlia', breve: 'figlio/a' },
    { r: 'padre', e: 'Padre', breve: 'padre' },
    { r: 'madre', e: 'Madre', breve: 'madre' },
    { r: 'altro', e: 'Altra persona', breve: 'altro' },
  ],

  gruppi: [
    { g: 'anagrafica', titolo: 'Anagrafica' },
    { g: 'genitori', titolo: 'Genitori', nota: 'Servono quando padre e madre non sono tra le persone della famiglia.' },
    { g: 'residenza', titolo: 'Residenza' },
    { g: 'domicilio', titolo: 'Domicilio', nota: 'Solo se è diverso dalla residenza.', chiuso: true },
    { g: 'contatti', titolo: 'Contatti' },
    { g: 'ci', titolo: "Carta d'identità" },
    { g: 'passaporto', titolo: 'Passaporto', chiuso: true },
    { g: 'patente', titolo: 'Patente di guida', chiuso: true },
    { g: 'ts', titolo: 'Tessera sanitaria', chiuso: true },
    { g: 'permesso', titolo: 'Permesso di soggiorno', chiuso: true },
    { g: 'lavoro', titolo: 'Lavoro e studio', chiuso: true },
    { g: 'scuola', titolo: 'Scuola', nota: 'Per figli e studenti.', chiuso: true },
    { g: 'banca', titolo: 'Banca', chiuso: true },
    { g: 'salute', titolo: 'Salute', chiuso: true },
  ],

  campi: [
    // Anagrafica
    { k: 'nome', e: 'Nome', g: 'anagrafica', es: 'Mario', seg: 'NOME',
      sin: ['nome', 'first name', 'firstname', 'given name', 'fname', 'prenome', 'forename'] },
    { k: 'cognome', e: 'Cognome', g: 'anagrafica', es: 'Rossi', seg: 'COGNOME',
      sin: ['cognome', 'last name', 'lastname', 'surname', 'family name', 'lname'] },
    { k: 'sesso', e: 'Sesso', g: 'anagrafica', tipo: 'sesso', seg: 'SESSO',
      sin: ['sesso', 'genere', 'gender', 'sex'] },
    { k: 'data_nascita', e: 'Data di nascita', g: 'anagrafica', tipo: 'data', seg: 'DATA DI NASCITA',
      sin: ['data nascita', 'data nasc', 'dt nascita', 'nato il', 'nata il', 'nato a il', 'birth date', 'date birth',
        'birthdate', 'birthday', 'dob', 'bday', 'giorno nascita', 'mese nascita', 'anno nascita'] },
    { k: 'luogo_nascita', e: 'Comune di nascita', g: 'anagrafica', es: 'Roma', seg: 'LUOGO DI NASCITA',
      sin: ['luogo nascita', 'comune nascita', 'citta nascita', 'localita nascita', 'nato a', 'nata a', 'nato a a',
        'birthplace', 'place birth', 'city birth', 'town birth'] },
    { k: 'provincia_nascita', e: 'Provincia di nascita', g: 'anagrafica', tipo: 'prov', es: 'RM', seg: 'PROVINCIA DI NASCITA',
      sin: ['provincia nascita', 'prov nascita', 'pr nascita', 'sigla provincia nascita'] },
    { k: 'nazione_nascita', e: 'Stato di nascita', g: 'anagrafica', es: 'Italia', seg: 'STATO DI NASCITA',
      sin: ['stato nascita', 'nazione nascita', 'paese nascita', 'stato estero nascita', 'country birth'] },
    { k: 'codice_fiscale', e: 'Codice fiscale', g: 'anagrafica', tipo: 'cf', es: 'RSSMRA80C12H501E', seg: 'CODICE FISCALE',
      sin: ['codice fiscale', 'cod fiscale', 'cod fisc', 'codfisc', 'cf', 'c f', 'tax code', 'fiscal code', 'tax id'] },
    { k: 'cittadinanza', e: 'Cittadinanza', g: 'anagrafica', es: 'Italiana', seg: 'CITTADINANZA',
      sin: ['cittadinanza', 'nazionalita', 'citizenship', 'nationality'] },
    { k: 'stato_civile', e: 'Stato civile', g: 'anagrafica', tipo: 'scelta', seg: 'STATO CIVILE',
      scelte: ['Celibe / nubile', 'Coniugato/a', 'Unito/a civilmente', 'Separato/a', 'Divorziato/a', 'Vedovo/a'],
      sin: ['stato civile', 'marital status', 'civil status'] },

    // Genitori (dati scritti sulla scheda della persona)
    { k: 'nome_padre', e: 'Nome del padre', g: 'genitori', es: 'Giuseppe' },
    { k: 'cognome_padre', e: 'Cognome del padre', g: 'genitori', es: 'Se vuoto uso il cognome della persona' },
    { k: 'nome_madre', e: 'Nome della madre', g: 'genitori', es: 'Anna' },
    { k: 'cognome_madre', e: 'Cognome della madre', g: 'genitori', es: 'Bianchi (da nubile)' },

    // Residenza
    { k: 'indirizzo', e: 'Indirizzo (via o piazza)', g: 'residenza', es: 'Via Appia Nuova', seg: 'INDIRIZZO',
      sin: ['indirizzo', 'via', 'via piazza', 'indirizzo residenza', 'residente via', 'address', 'street', 'street address',
        'address line 1', 'address 1', 'domicilio', 'nome via', 'nome strada', 'via numero civico', 'via n civico',
        'via civico', 'indirizzo numero civico', 'indirizzo civico'],
      escl: ['mail', 'email', 'pec', 'ip', 'web', 'sito', 'url', 'nascita', 'address 2', 'address line 2'] },
    { k: 'civico', e: 'Numero civico', g: 'residenza', es: '12', seg: 'CIVICO',
      sin: ['civico', 'numero civico', 'n civico', 'num civico', 'nr civico', 'civ', 'n civ', 'house number', 'street number'],
      escl: ['telefono', 'documento'] },
    { k: 'cap', e: 'CAP', g: 'residenza', tipo: 'cap', es: '00183', seg: 'CAP',
      sin: ['cap', 'c a p', 'codice avviamento postale', 'postal code', 'postcode', 'zip', 'zip code', 'zipcode'] },
    { k: 'citta', e: 'Comune di residenza', g: 'residenza', es: 'Roma', seg: 'COMUNE',
      sin: ['citta', 'comune', 'comune residenza', 'citta residenza', 'residente a', 'residente nel comune', 'localita',
        'city', 'town', 'residenza', 'comune domicilio'],
      escl: ['nascita', 'birth', 'rilascio', 'emissione'] },
    { k: 'provincia', e: 'Provincia', g: 'residenza', tipo: 'prov', es: 'RM', seg: 'PROVINCIA',
      sin: ['provincia', 'prov', 'pr', 'sigla provincia', 'provincia residenza', 'province', 'state province', 'county'],
      escl: ['nascita', 'birth', 'rilascio'] },
    { k: 'nazione', e: 'Nazione', g: 'residenza', es: 'Italia', seg: 'NAZIONE',
      sin: ['nazione', 'paese', 'country', 'stato residenza', 'nazione residenza', 'paese residenza', 'country region'],
      escl: ['nascita', 'birth'] },

    // Domicilio: si usa quando il modulo parla di domicilio
    { k: 'dom_indirizzo', e: 'Indirizzo del domicilio', g: 'domicilio', es: 'Via Tiburtina' },
    { k: 'dom_civico', e: 'Numero civico', g: 'domicilio', es: '5' },
    { k: 'dom_cap', e: 'CAP', g: 'domicilio', tipo: 'cap', es: '00159' },
    { k: 'dom_citta', e: 'Comune', g: 'domicilio', es: 'Roma' },
    { k: 'dom_provincia', e: 'Provincia', g: 'domicilio', tipo: 'prov', es: 'RM' },

    // Contatti
    { k: 'telefono', e: 'Cellulare', g: 'contatti', tipo: 'tel', es: '333 1234567', seg: 'TELEFONO',
      sin: ['telefono', 'tel', 'cellulare', 'cell', 'phone', 'mobile', 'telephone', 'numero telefono', 'numero cellulare',
        'recapito telefonico', 'telefono cellulare', 'smartphone', 'phone number'],
      escl: ['fax', 'prefisso', 'fisso', 'casa', 'abitazione', 'ufficio'] },
    { k: 'telefono_fisso', e: 'Telefono fisso', g: 'contatti', tipo: 'tel', es: '06 1234567', seg: 'TELEFONO FISSO',
      sin: ['telefono fisso', 'tel fisso', 'fisso', 'telefono casa', 'telefono abitazione', 'home phone', 'landline'] },
    { k: 'email', e: 'Email', g: 'contatti', tipo: 'email', es: 'mario.rossi@esempio.it', seg: 'EMAIL',
      sin: ['email', 'mail', 'posta elettronica', 'indirizzo email', 'email address', 'e mail address'] },
    { k: 'pec', e: 'PEC', g: 'contatti', tipo: 'email', es: 'mario.rossi@pec.it', seg: 'PEC',
      sin: ['pec', 'posta elettronica certificata', 'email pec', 'mail pec', 'indirizzo pec', 'domicilio digitale'] },

    // Carta d'identità
    { k: 'ci_tipo', e: 'Tipo', g: 'ci', tipo: 'scelta', scelte: ["Carta d'identità elettronica", "Carta d'identità cartacea"] },
    { k: 'ci_numero', e: 'Numero', g: 'ci', es: 'CA12345AB', seg: 'NUMERO CARTA IDENTITA' },
    { k: 'ci_comune', e: 'Rilasciata dal Comune di', g: 'ci', es: 'Roma' },
    { k: 'ci_data_rilascio', e: 'Data di rilascio', g: 'ci', tipo: 'data' },
    { k: 'ci_scadenza', e: 'Data di scadenza', g: 'ci', tipo: 'data', seg: 'SCADENZA CARTA IDENTITA' },

    // Passaporto
    { k: 'passaporto_numero', e: 'Numero', g: 'passaporto', es: 'YA1234567', seg: 'NUMERO PASSAPORTO' },
    { k: 'passaporto_rilascio', e: 'Rilasciato da', g: 'passaporto', es: 'Questura di Roma' },
    { k: 'passaporto_data_rilascio', e: 'Data di rilascio', g: 'passaporto', tipo: 'data' },
    { k: 'passaporto_scadenza', e: 'Data di scadenza', g: 'passaporto', tipo: 'data', seg: 'SCADENZA PASSAPORTO' },

    // Patente
    { k: 'patente_numero', e: 'Numero', g: 'patente', es: 'RM1234567X', seg: 'NUMERO PATENTE' },
    { k: 'patente_categoria', e: 'Categorie', g: 'patente', es: 'B',
      sin: ['categoria patente', 'categorie patente', 'patente categoria', 'patente categorie', 'tipo patente'] },
    { k: 'patente_rilascio', e: 'Rilasciata da', g: 'patente', es: 'MIT-UCO' },
    { k: 'patente_data_rilascio', e: 'Data di rilascio', g: 'patente', tipo: 'data' },
    { k: 'patente_scadenza', e: 'Data di scadenza', g: 'patente', tipo: 'data', seg: 'SCADENZA PATENTE' },

    // Tessera sanitaria
    { k: 'ts_numero', e: 'Numero di identificazione della tessera', g: 'ts', es: '80380001234567890123', seg: 'NUMERO TESSERA SANITARIA' },
    { k: 'ts_scadenza', e: 'Data di scadenza', g: 'ts', tipo: 'data' },

    // Permesso di soggiorno
    { k: 'permesso_tipo', e: 'Motivo del permesso', g: 'permesso', es: 'Lavoro subordinato',
      sin: ['motivo permesso', 'tipo permesso', 'tipologia permesso', 'motivo soggiorno'] },
    { k: 'permesso_numero', e: 'Numero', g: 'permesso', es: 'I12345678' },
    { k: 'permesso_rilascio', e: 'Rilasciato da', g: 'permesso', es: 'Questura di Roma' },
    { k: 'permesso_data_rilascio', e: 'Data di rilascio', g: 'permesso', tipo: 'data' },
    { k: 'permesso_scadenza', e: 'Data di scadenza', g: 'permesso', tipo: 'data' },

    // Lavoro e studio
    { k: 'professione', e: 'Professione', g: 'lavoro', es: 'Impiegato', seg: 'PROFESSIONE',
      sin: ['professione', 'occupazione', 'lavoro', 'attivita lavorativa', 'condizione professionale', 'mestiere',
        'occupation', 'job', 'job title'],
      escl: ['datore', 'sede', 'indirizzo'] },
    { k: 'datore_lavoro', e: 'Datore di lavoro', g: 'lavoro', es: 'Esempio S.p.A.', org: true, seg: 'DATORE DI LAVORO',
      sin: ['datore lavoro', 'nome datore lavoro', 'ragione sociale datore lavoro', 'azienda presso cui lavora', 'employer'],
      escl: ['indirizzo', 'via', 'telefono', 'tel', 'email', 'mail', 'pec', 'cap', 'comune', 'citta', 'codice', 'partita', 'iva', 'sede'] },
    { k: 'partita_iva', e: 'Partita IVA', g: 'lavoro', es: '01234567890', seg: 'PARTITA IVA',
      sin: ['partita iva', 'p iva', 'piva', 'vat number', 'vat'] },
    { k: 'titolo_studio', e: 'Titolo di studio', g: 'lavoro', tipo: 'scelta', seg: 'TITOLO DI STUDIO',
      scelte: ['Licenza elementare', 'Licenza media', 'Diploma di scuola superiore', 'Laurea triennale', 'Laurea magistrale', 'Dottorato'],
      sin: ['titolo studio', 'grado istruzione', 'livello istruzione', 'istruzione', 'education'] },

    // Scuola
    { k: 'scuola', e: 'Scuola frequentata', g: 'scuola', es: 'I.C. Via Roma', org: true, seg: 'SCUOLA',
      sin: ['scuola frequentata', 'scuola', 'istituto frequentato', 'istituto scolastico', 'nome scuola', 'denominazione scuola', 'plesso', 'school'],
      escl: ['indirizzo', 'via', 'telefono', 'tel', 'email', 'mail', 'pec', 'cap', 'comune', 'citta', 'codice', 'meccanografico', 'provenienza'] },
    { k: 'classe', e: 'Classe', g: 'scuola', es: '3ª', seg: 'CLASSE',
      sin: ['classe', 'classe frequentata', 'anno corso', 'class', 'grade'] },
    { k: 'sezione', e: 'Sezione', g: 'scuola', es: 'B', seg: 'SEZIONE', sin: ['sezione', 'section'] },

    // Banca
    { k: 'iban', e: 'IBAN', g: 'banca', es: 'IT60X0542811101000000123456', seg: 'IBAN',
      sin: ['iban', 'codice iban', 'coordinate bancarie', 'conto corrente', 'numero conto', 'account number'],
      escl: ['intestatario', 'intestato'] },
    { k: 'banca', e: 'Banca', g: 'banca', es: 'Banca Esempio', org: true, seg: 'BANCA',
      sin: ['banca', 'nome banca', 'istituto credito', 'bank', 'bank name'],
      escl: ['iban', 'codice', 'conto', 'filiale', 'indirizzo', 'abi', 'cab'] },
    { k: 'bic', e: 'BIC / SWIFT', g: 'banca', es: 'BPMOIT22XXX', sin: ['bic', 'swift', 'codice bic', 'codice swift'] },

    // Salute
    { k: 'medico_base', e: 'Medico di famiglia o pediatra', g: 'salute', es: 'Dott. Bianchi', seg: 'MEDICO DI BASE',
      sin: ['medico base', 'medico famiglia', 'medico curante', 'medico medicina generale', 'pediatra', 'mmg', 'pls'] },
    { k: 'gruppo_sanguigno', e: 'Gruppo sanguigno', g: 'salute', es: '0 Rh+', sin: ['gruppo sanguigno', 'gruppo sangue', 'blood type'] },

    // Valori ricavati dagli altri dati
    { k: 'nome_completo', e: 'Nome e cognome', calc: true, seg: 'NOME E COGNOME',
      sin: ['nome cognome', 'cognome nome', 'nominativo', 'nome completo', 'generalita', 'intestatario', 'name',
        'full name', 'fullname', 'sottoscritto', 'sottoscritta'] },
    { k: 'eta', e: 'Età', calc: true, seg: 'ETA', sin: ['eta', 'age'] },
    { k: 'luogo_data_nascita', e: 'Luogo e data di nascita', calc: true, sin: ['luogo data nascita'] },
    { k: 'indirizzo_completo', e: 'Indirizzo completo', calc: true, seg: 'INDIRIZZO COMPLETO',
      sin: ['indirizzo completo', 'residenza completa', 'recapito completo'] },
    { k: 'tipo_documento', e: 'Tipo di documento', calc: true, tipo: 'doc', seg: 'TIPO DOCUMENTO',
      sin: ['tipo documento', 'tipologia documento', 'documento', 'documento identita', 'documento riconoscimento',
        'document type', 'id type'] },
    { k: 'numero_documento', e: 'Numero del documento', calc: true, seg: 'NUMERO DOCUMENTO',
      sin: ['numero documento', 'n documento', 'num documento', 'nr documento', 'documento n', 'documento numero',
        'estremi documento', 'document number', 'id number', 'numero passaporto', 'n passaporto', 'passaporto n',
        'passaporto numero', 'numero patente', 'n patente', 'patente n', 'numero carta identita', 'n carta identita',
        'carta identita n', 'numero ci', 'numero cie', 'numero tessera sanitaria', 'tessera sanitaria n',
        'numero identificazione tessera', 'tessera sanitaria', 'numero permesso soggiorno', 'permesso soggiorno n',
        'passport number', 'licence number', 'license number'] },
    { k: 'rilasciato_da', e: 'Documento rilasciato da', calc: true, seg: 'RILASCIATO DA',
      sin: ['rilasciato da', 'rilasciata da', 'rilasciato', 'rilasciata', 'ente rilascio', 'autorita rilascio',
        'comune rilascio', 'luogo rilascio', 'emesso da', 'issued by', 'issuing authority'] },
    { k: 'data_rilascio', e: 'Data di rilascio del documento', calc: true, tipo: 'data', seg: 'DATA RILASCIO',
      sin: ['data rilascio', 'rilasciato il', 'rilasciata il', 'data emissione', 'emesso il', 'issue date', 'date issue'] },
    { k: 'scadenza_documento', e: 'Scadenza del documento', calc: true, tipo: 'data', seg: 'SCADENZA DOCUMENTO',
      sin: ['data scadenza', 'scadenza', 'scadenza documento', 'valido fino', 'valida fino', 'expiry date',
        'expiration date', 'date expiry', 'valid until'] },
    { k: 'luogo', e: 'Luogo (comune di residenza)', calc: true, doc: true, seg: 'LUOGO',
      sin: ['luogo', 'luogo firma', 'citta firma'] },
    { k: 'oggi', e: 'Data di oggi', calc: true, doc: true, seg: 'DATA',
      sin: ['data', 'data odierna', 'oggi', 'data oggi', 'data attuale', 'data firma', 'data compilazione'] },
    { k: 'luogo_data', e: 'Luogo e data di oggi', calc: true, doc: true, seg: 'LUOGO E DATA',
      sin: ['luogo data', 'data luogo'] },
  ],

  // Veicoli
  gruppiVeicolo: [
    { g: 'veicolo', titolo: 'Veicolo' },
    { g: 'scadenze', titolo: 'Assicurazione e scadenze' },
  ],
  campiVeicolo: [
    { k: 'v_tipo', e: 'Tipo', g: 'veicolo', tipo: 'scelta', scelte: ['Automobile', 'Motociclo', 'Ciclomotore', 'Autocarro', 'Camper', 'Altro'],
      sin: ['tipo veicolo', 'categoria veicolo', 'vehicle type'] },
    { k: 'targa', e: 'Targa', g: 'veicolo', es: 'AB123CD', seg: 'TARGA',
      sin: ['targa', 'targa veicolo', 'numero targa', 'n targa', 'targa auto', 'license plate', 'plate number', 'registration number'] },
    { k: 'marca', e: 'Marca', g: 'veicolo', es: 'Fiat', seg: 'MARCA',
      sin: ['marca', 'marca veicolo', 'casa costruttrice', 'fabbrica', 'make', 'brand'],
      escl: ['bollo', 'tempo'] },
    { k: 'modello', e: 'Modello', g: 'veicolo', es: 'Panda', seg: 'MODELLO',
      sin: ['modello', 'modello veicolo', 'model'],
      escl: ['730', 'f24', 'isee', 'unico', 'redditi', 'dichiarazione', 'modulo', 'domanda', 'iscrizione'] },
    { k: 'telaio', e: 'Numero di telaio', g: 'veicolo', es: 'ZFA31200000123456', seg: 'TELAIO',
      sin: ['telaio', 'numero telaio', 'n telaio', 'codice telaio', 'vin', 'chassis'] },
    { k: 'immatricolazione', e: 'Prima immatricolazione', g: 'veicolo', tipo: 'data', seg: 'DATA IMMATRICOLAZIONE',
      sin: ['data immatricolazione', 'prima immatricolazione', 'data prima immatricolazione', 'immatricolazione',
        'immatricolato il', 'registration date'] },
    { k: 'alimentazione', e: 'Alimentazione', g: 'veicolo', es: 'Benzina', sin: ['alimentazione', 'carburante', 'fuel'] },
    { k: 'cilindrata', e: 'Cilindrata (cm³)', g: 'veicolo', es: '1242', sin: ['cilindrata', 'engine size'] },
    { k: 'potenza_kw', e: 'Potenza (kW)', g: 'veicolo', es: '51', sin: ['potenza', 'kw', 'potenza kw', 'power'] },
    { k: 'assicurazione', e: 'Compagnia assicurativa', g: 'scadenze', es: 'Assicurazioni Esempio', seg: 'ASSICURAZIONE',
      sin: ['compagnia assicurativa', 'compagnia assicurazione', 'assicurazione', 'compagnia', 'assicuratore',
        'insurance company', 'insurer'],
      escl: ['scadenza', 'numero', 'polizza', 'data'] },
    { k: 'polizza', e: 'Numero di polizza', g: 'scadenze', es: '123456789', seg: 'NUMERO POLIZZA',
      sin: ['numero polizza', 'polizza', 'n polizza', 'polizza n', 'policy number'],
      escl: ['scadenza'] },
    { k: 'scadenza_assicurazione', e: 'Scadenza assicurazione', g: 'scadenze', tipo: 'data',
      sin: ['scadenza assicurazione', 'scadenza polizza', 'scadenza rca'] },
    { k: 'scadenza_revisione', e: 'Scadenza revisione', g: 'scadenze', tipo: 'data',
      sin: ['scadenza revisione', 'revisione', 'prossima revisione', 'data revisione'] },
    { k: 'scadenza_bollo', e: 'Scadenza bollo', g: 'scadenze', tipo: 'data',
      sin: ['scadenza bollo', 'bollo auto', 'bollo'],
      escl: ['marca', 'identificativo', 'codice', 'numero', 'importo', 'euro'] },
  ],

  // Documenti: quando un modulo nomina un documento, «numero», «scadenza»… sono quelli di quel documento
  documenti: {
    ci: { nome: "Carta d'identità", parole: ['carta identita', 'cie', 'ci', 'c i', 'identity card', 'id card'],
      campi: { numero_documento: 'ci_numero', rilasciato_da: 'ci_comune', data_rilascio: 'ci_data_rilascio', scadenza_documento: 'ci_scadenza' } },
    passaporto: { nome: 'Passaporto', parole: ['passaporto', 'passport'],
      campi: { numero_documento: 'passaporto_numero', rilasciato_da: 'passaporto_rilascio', data_rilascio: 'passaporto_data_rilascio', scadenza_documento: 'passaporto_scadenza' } },
    patente: { nome: 'Patente di guida', parole: ['patente', 'driving licence', 'driver license', 'driving license'],
      campi: { numero_documento: 'patente_numero', rilasciato_da: 'patente_rilascio', data_rilascio: 'patente_data_rilascio', scadenza_documento: 'patente_scadenza' } },
    ts: { nome: 'Tessera sanitaria', parole: ['tessera sanitaria', 'tessera team', 'team'],
      campi: { numero_documento: 'ts_numero', scadenza_documento: 'ts_scadenza' } },
    permesso: { nome: 'Permesso di soggiorno', parole: ['permesso soggiorno', 'carta soggiorno', 'residence permit'],
      campi: { numero_documento: 'permesso_numero', rilasciato_da: 'permesso_rilascio', data_rilascio: 'permesso_data_rilascio', scadenza_documento: 'permesso_scadenza' } },
  },
  // Ordine con cui si sceglie il documento quando il modulo chiede «un documento» qualsiasi
  documentoPrincipale: ['ci', 'passaporto', 'patente'],

  domicilio: {
    parole: ['domicilio', 'domiciliato', 'domiciliata', 'recapito'],
    campi: { indirizzo: 'dom_indirizzo', civico: 'dom_civico', cap: 'dom_cap', citta: 'dom_citta', provincia: 'dom_provincia' },
  },

  // Parole che indicano di quale persona parla una sezione o un campo
  ruoli: {
    padre: ['padre', 'paternita', 'father', 'papa'],
    madre: ['madre', 'maternita', 'mother', 'mamma'],
    coniuge: ['coniuge', 'marito', 'moglie', 'consorte', 'spouse', 'husband', 'wife'],
    genitore: ['genitore', 'genitori', 'esercente responsabilita genitoriale', 'parent'],
    figlio: ['figlio', 'figlia', 'figli', 'figlie', 'alunno', 'alunna', 'alunni', 'studente', 'studentessa', 'minore',
      'bambino', 'bambina', 'neonato', 'neonata', 'child', 'pupil'],
    // chi firma: è il genitore quando si compila per un figlio
    dichiarante: ['dichiarante', 'richiedente', 'sottoscritto', 'sottoscritta', 'istante'],
    // persone che non sono nella famiglia: i loro campi restano vuoti
    altro: ['delegato', 'delegata', 'delegante', 'tutore', 'beneficiario', 'beneficiaria', 'convivente', 'defunto',
      'defunta', 'deceduto', 'deceduta', 'emergenza', 'referente', 'familiare', 'nonno', 'nonna', 'fratello', 'sorella',
      'testimone', 'erede', 'procuratore', 'partner', 'emergency'],
  },
  veicolo: ['veicolo', 'auto', 'automobile', 'autoveicolo', 'autovettura', 'moto', 'motociclo', 'vettura', 'vehicle', 'car'],

  // Spazi da riempire nelle lettere («nato a ______»): parole che li precedono.
  // «padre:nome» = nome del padre. Le chiavi con @ dipendono dal dato inserito subito prima.
  spazi: [
    ['sottoscritto', 'nome_completo'], ['sottoscritta', 'nome_completo'], ['sottoscritto a', 'nome_completo'],
    ['nome cognome', 'nome_completo'], ['cognome nome', 'nome_completo'], ['generalita', 'nome_completo'],
    ['nome', 'nome'], ['cognome', 'cognome'],
    ['nato a', 'luogo_nascita'], ['nata a', 'luogo_nascita'], ['nato a a', 'luogo_nascita'],
    ['luogo nascita', 'luogo_nascita'], ['comune nascita', 'luogo_nascita'],
    ['nato il', 'data_nascita'], ['nata il', 'data_nascita'], ['nato a il', 'data_nascita'], ['data nascita', 'data_nascita'],
    ['il', '@il'],
    ['figlio', 'padre:nome_completo'], ['figlia', 'padre:nome_completo'], ['figlio a', 'padre:nome_completo'],
    ['padre', 'padre:nome_completo'], ['madre', 'madre:nome_completo'],
    ['nome padre', 'padre:nome'], ['cognome padre', 'padre:cognome'], ['nome madre', 'madre:nome'], ['cognome madre', 'madre:cognome'],
    ['paternita', 'padre:nome'], ['maternita', 'madre:nome'],
    ['coniugato con', 'coniuge:nome_completo'], ['coniugata con', 'coniuge:nome_completo'], ['coniugato a con', 'coniuge:nome_completo'],
    ['sposato con', 'coniuge:nome_completo'], ['sposata con', 'coniuge:nome_completo'], ['sposato a con', 'coniuge:nome_completo'],
    ['codice fiscale', 'codice_fiscale'], ['cf', 'codice_fiscale'], ['c f', 'codice_fiscale'],
    ['cod fisc', 'codice_fiscale'], ['cod fiscale', 'codice_fiscale'],
    ['cittadinanza', 'cittadinanza'], ['nazionalita', 'cittadinanza'],
    ['residente a', 'citta'], ['residente in', 'citta'], ['residente', 'citta'], ['residente nel comune', 'citta'],
    ['comune', 'citta'], ['comune residenza', 'citta'],
    ['via', 'indirizzo'], ['in via', 'indirizzo'], ['via piazza', 'indirizzo'], ['viale', 'indirizzo'],
    ['piazza', 'indirizzo'], ['corso', 'indirizzo'], ['indirizzo', 'indirizzo'],
    ['n', '@n'], ['nr', '@n'], ['num', '@n'], ['numero', '@n'],
    ['civico', 'civico'], ['numero civico', 'civico'], ['n civico', 'civico'],
    ['cap', 'cap'],
    ['prov', '@prov'], ['provincia', '@prov'], ['pr', '@prov'],
    ['tel', 'telefono'], ['telefono', 'telefono'], ['cellulare', 'telefono'], ['cell', 'telefono'], ['recapito telefonico', 'telefono'],
    ['email', 'email'], ['mail', 'email'], ['posta elettronica', 'email'], ['pec', 'pec'],
    ['documento', 'tipo_documento'], ['documento identita', 'tipo_documento'], ['documento riconoscimento', 'tipo_documento'],
    ['carta identita', 'ci_numero'], ['carta identita n', 'ci_numero'], ['passaporto', 'passaporto_numero'],
    ['passaporto n', 'passaporto_numero'], ['patente', 'patente_numero'], ['patente n', 'patente_numero'],
    ['rilasciato da', 'rilasciato_da'], ['rilasciata da', 'rilasciato_da'], ['rilasciato a da', 'rilasciato_da'],
    ['rilasciato dal comune', 'rilasciato_da'], ['rilasciata dal comune', 'rilasciato_da'],
    ['rilasciato il', 'data_rilascio'], ['rilasciata il', 'data_rilascio'], ['data rilascio', 'data_rilascio'],
    ['scadenza', 'scadenza_documento'], ['valido fino', 'scadenza_documento'], ['valida fino', 'scadenza_documento'],
    ['valido fino al', 'scadenza_documento'], ['valida fino al', 'scadenza_documento'],
    ['targa', 'targa'], ['targato', 'targa'], ['targata', 'targa'], ['telaio', 'telaio'],
    ['professione', 'professione'],
    ['li', 'oggi'], ['data', 'oggi'], ['luogo data', 'luogo_data'], ['luogo', 'luogo'],
  ],

  // Parole che non contano per riconoscere un campo
  stop: ['di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dell', 'd', 'l', 'e', 'ed', 'of', 'the', 'your',
    's', 'tuo', 'tua', 'suo', 'sua', 'inserisci', 'inserire', 'indicare', 'indica', 'digita', 'scrivi', 'please', 'enter'],

  // Campi da non toccare mai
  salta: ['utente', 'user', 'username', 'login', 'account', 'nickname', 'password', 'captcha', 'otp', 'coupon',
    'sconto', 'promo', 'promozionale', 'discount', 'voucher', 'cerca', 'ricerca', 'search', 'newsletter', 'file',
    'allegato', 'allegati', 'cvv', 'cvc', 'pin'],

  // Campi che riguardano un ente: si riempiono solo i dati segnati «org»
  org: ['azienda', 'aziendale', 'ditta', 'societa', 'impresa', 'organizzazione', 'company', 'business', 'datore',
    'scuola', 'istituto', 'struttura', 'negozio', 'fornitore', 'banca', 'filiale'],

  // Nelle lettere anche il destinatario è un'altra persona
  altriDoc: ['destinatario', 'destinataria', 'spettabile', 'spett', 'egregio', 'gentile', 'gent', 'dirigente',
    'sindaco', 'responsabile', 'ufficio', 'avvocato', 'presidente', 'direttore', 'assessore'],

  conferma: ['conferma', 'confermare', 'ripeti', 'ripetere', 'verifica', 'reinserisci', 'confirm', 'repeat', 'retype'],

  mesi: [
    ['gennaio', 'gen', 'january', 'jan'], ['febbraio', 'feb', 'february', 'feb'], ['marzo', 'mar', 'march', 'mar'],
    ['aprile', 'apr', 'april', 'apr'], ['maggio', 'mag', 'may', 'may'], ['giugno', 'giu', 'june', 'jun'],
    ['luglio', 'lug', 'july', 'jul'], ['agosto', 'ago', 'august', 'aug'], ['settembre', 'set', 'september', 'sep'],
    ['ottobre', 'ott', 'october', 'oct'], ['novembre', 'nov', 'november', 'nov'], ['dicembre', 'dic', 'december', 'dec'],
  ],

  province: {
    AG: 'Agrigento', AL: 'Alessandria', AN: 'Ancona', AO: 'Aosta', AP: 'Ascoli Piceno', AQ: "L'Aquila",
    AR: 'Arezzo', AT: 'Asti', AV: 'Avellino', BA: 'Bari', BG: 'Bergamo', BI: 'Biella', BL: 'Belluno',
    BN: 'Benevento', BO: 'Bologna', BR: 'Brindisi', BS: 'Brescia', BT: 'Barletta-Andria-Trani', BZ: 'Bolzano',
    CA: 'Cagliari', CB: 'Campobasso', CE: 'Caserta', CH: 'Chieti', CI: 'Sulcis Iglesiente', CL: 'Caltanissetta',
    CN: 'Cuneo', CO: 'Como', CR: 'Cremona', CS: 'Cosenza', CT: 'Catania', CZ: 'Catanzaro', EN: 'Enna',
    FC: 'Forlì-Cesena', FE: 'Ferrara', FG: 'Foggia', FI: 'Firenze', FM: 'Fermo', FR: 'Frosinone', GE: 'Genova',
    GO: 'Gorizia', GR: 'Grosseto', IM: 'Imperia', IS: 'Isernia', KR: 'Crotone', LC: 'Lecco', LE: 'Lecce',
    LI: 'Livorno', LO: 'Lodi', LT: 'Latina', LU: 'Lucca', MB: 'Monza e Brianza', MC: 'Macerata', ME: 'Messina',
    MI: 'Milano', MN: 'Mantova', MO: 'Modena', MS: 'Massa-Carrara', MT: 'Matera', NA: 'Napoli', NO: 'Novara',
    NU: 'Nuoro', OG: 'Ogliastra', OR: 'Oristano', OT: 'Gallura Nord-Est Sardegna', PA: 'Palermo', PC: 'Piacenza',
    PD: 'Padova', PE: 'Pescara', PG: 'Perugia', PI: 'Pisa', PN: 'Pordenone', PO: 'Prato', PR: 'Parma',
    PT: 'Pistoia', PU: 'Pesaro e Urbino', PV: 'Pavia', PZ: 'Potenza', RA: 'Ravenna', RC: 'Reggio Calabria',
    RE: 'Reggio Emilia', RG: 'Ragusa', RI: 'Rieti', RM: 'Roma', RN: 'Rimini', RO: 'Rovigo', SA: 'Salerno',
    SI: 'Siena', SO: 'Sondrio', SP: 'La Spezia', SR: 'Siracusa', SS: 'Sassari', SU: 'Sud Sardegna', SV: 'Savona',
    TA: 'Taranto', TE: 'Teramo', TN: 'Trento', TO: 'Torino', TP: 'Trapani', TR: 'Terni', TS: 'Trieste',
    TV: 'Treviso', UD: 'Udine', VA: 'Varese', VB: 'Verbano-Cusio-Ossola', VC: 'Vercelli', VE: 'Venezia',
    VI: 'Vicenza', VR: 'Verona', VS: 'Medio Campidano', VT: 'Viterbo', VV: 'Vibo Valentia',
  },
};
