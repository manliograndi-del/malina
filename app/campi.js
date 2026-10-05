/*
 * Compilatutto – i dati di una persona e le parole con cui i moduli li chiamano.
 *
 * Ogni campo ha:
 *   k     chiave interna
 *   e     etichetta mostrata nell'app
 *   g     gruppo nella scheda «I miei dati» (assente per i campi calcolati)
 *   seg   segnaposto standard da usare nelle lettere, es. [NOME PADRE]
 *   sin   parole o frasi che, trovate nell'etichetta di un campo, lo identificano
 *   escl  parole che, se presenti, escludono il campo
 *   rel   «padre» o «madre» per i dati dei genitori
 *   doc   true se il campo vale solo per lettere e documenti
 *   calc  true se il valore è ricavato da altri campi
 */
const CT = {
  gruppi: [
    { g: 'persona', titolo: 'Persona' },
    { g: 'genitori', titolo: 'Genitori' },
    { g: 'residenza', titolo: 'Residenza' },
    { g: 'contatti', titolo: 'Contatti' },
    { g: 'documento', titolo: 'Documento di identità' },
    { g: 'altro', titolo: 'Lavoro' },
  ],

  campi: [
    // Persona
    { k: 'nome', e: 'Nome', g: 'persona', es: 'Mario', seg: 'NOME',
      sin: ['nome', 'first name', 'firstname', 'given name', 'fname', 'prenome', 'forename'] },
    { k: 'cognome', e: 'Cognome', g: 'persona', es: 'Rossi', seg: 'COGNOME',
      sin: ['cognome', 'last name', 'lastname', 'surname', 'family name', 'lname'] },
    { k: 'sesso', e: 'Sesso', g: 'persona', tipo: 'sesso', seg: 'SESSO',
      sin: ['sesso', 'genere', 'gender', 'sex'] },
    { k: 'data_nascita', e: 'Data di nascita', g: 'persona', tipo: 'data', seg: 'DATA DI NASCITA',
      sin: ['data nascita', 'data nasc', 'dt nascita', 'nato il', 'nata il', 'nato a il', 'birth date', 'date birth',
        'birthdate', 'birthday', 'dob', 'bday', 'giorno nascita', 'mese nascita', 'anno nascita'] },
    { k: 'luogo_nascita', e: 'Comune di nascita', g: 'persona', es: 'Roma', seg: 'LUOGO DI NASCITA',
      sin: ['luogo nascita', 'comune nascita', 'citta nascita', 'localita nascita', 'nato a', 'nata a', 'nato a a',
        'birthplace', 'place birth', 'city birth', 'town birth'] },
    { k: 'provincia_nascita', e: 'Provincia di nascita', g: 'persona', tipo: 'prov', es: 'RM', seg: 'PROVINCIA DI NASCITA',
      sin: ['provincia nascita', 'prov nascita', 'pr nascita', 'sigla provincia nascita'] },
    { k: 'nazione_nascita', e: 'Stato di nascita', g: 'persona', es: 'Italia', seg: 'STATO DI NASCITA',
      sin: ['stato nascita', 'nazione nascita', 'paese nascita', 'stato estero nascita', 'country birth'] },
    { k: 'codice_fiscale', e: 'Codice fiscale', g: 'persona', tipo: 'cf', es: 'RSSMRA80C12H501E', seg: 'CODICE FISCALE',
      sin: ['codice fiscale', 'cod fiscale', 'cod fisc', 'codfisc', 'cf', 'c f', 'tax code', 'fiscal code', 'tax id'] },
    { k: 'cittadinanza', e: 'Cittadinanza', g: 'persona', es: 'Italiana', seg: 'CITTADINANZA',
      sin: ['cittadinanza', 'nazionalita', 'citizenship', 'nationality'] },

    // Genitori
    { k: 'nome_padre', e: 'Nome del padre', g: 'genitori', es: 'Giuseppe', rel: 'padre', seg: 'NOME PADRE',
      sin: ['nome padre', 'padre nome', 'paternita', 'padre', 'father name', 'fathers name', 'father'] },
    { k: 'cognome_padre', e: 'Cognome del padre', g: 'genitori', es: 'Se vuoto uso il tuo', rel: 'padre', seg: 'COGNOME PADRE',
      sin: ['cognome padre', 'padre cognome', 'father surname', 'father last name'] },
    { k: 'nome_madre', e: 'Nome della madre', g: 'genitori', es: 'Anna', rel: 'madre', seg: 'NOME MADRE',
      sin: ['nome madre', 'madre nome', 'maternita', 'madre', 'mother name', 'mothers name', 'mother'] },
    { k: 'cognome_madre', e: 'Cognome della madre', g: 'genitori', es: 'Bianchi (da nubile)', rel: 'madre', seg: 'COGNOME MADRE',
      sin: ['cognome madre', 'madre cognome', 'cognome nubile madre', 'mother surname', 'mother maiden name', 'mother last name'] },

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

    // Contatti
    { k: 'telefono', e: 'Telefono / cellulare', g: 'contatti', tipo: 'tel', es: '333 1234567', seg: 'TELEFONO',
      sin: ['telefono', 'tel', 'cellulare', 'cell', 'phone', 'mobile', 'telephone', 'numero telefono', 'numero cellulare',
        'recapito telefonico', 'telefono cellulare', 'smartphone', 'phone number'],
      escl: ['fax', 'prefisso'] },
    { k: 'email', e: 'Email', g: 'contatti', tipo: 'email', es: 'mario.rossi@esempio.it', seg: 'EMAIL',
      sin: ['email', 'mail', 'posta elettronica', 'indirizzo email', 'email address', 'e mail address'] },
    { k: 'pec', e: 'PEC', g: 'contatti', tipo: 'email', es: 'mario.rossi@pec.it', seg: 'PEC',
      sin: ['pec', 'posta elettronica certificata', 'email pec', 'mail pec', 'indirizzo pec', 'domicilio digitale'] },

    // Documento
    { k: 'tipo_documento', e: 'Tipo di documento', g: 'documento', tipo: 'doc', es: "Carta d'identità", seg: 'TIPO DOCUMENTO',
      sin: ['tipo documento', 'tipologia documento', 'documento', 'documento identita', 'documento riconoscimento',
        'document type', 'id type'] },
    { k: 'numero_documento', e: 'Numero del documento', g: 'documento', es: 'CA12345AB', seg: 'NUMERO DOCUMENTO',
      sin: ['numero documento', 'n documento', 'num documento', 'nr documento', 'documento n', 'documento numero',
        'estremi documento', 'numero carta identita', 'numero passaporto', 'numero patente', 'document number',
        'id number', 'passport number'] },
    { k: 'rilasciato_da', e: 'Rilasciato da', g: 'documento', es: 'Comune di Roma', seg: 'RILASCIATO DA',
      sin: ['rilasciato da', 'rilasciata da', 'rilasciato', 'rilasciata', 'ente rilascio', 'autorita rilascio',
        'comune rilascio', 'emesso da', 'issued by', 'issuing authority'] },
    { k: 'data_rilascio', e: 'Data di rilascio', g: 'documento', tipo: 'data', seg: 'DATA RILASCIO',
      sin: ['data rilascio', 'rilasciato il', 'rilasciata il', 'data emissione', 'emesso il', 'issue date', 'date issue'] },
    { k: 'scadenza_documento', e: 'Data di scadenza', g: 'documento', tipo: 'data', seg: 'SCADENZA DOCUMENTO',
      sin: ['data scadenza', 'scadenza', 'scadenza documento', 'valido fino', 'valida fino', 'expiry date',
        'expiration date', 'date expiry'] },

    // Lavoro
    { k: 'professione', e: 'Professione', g: 'altro', es: 'Impiegato', seg: 'PROFESSIONE',
      sin: ['professione', 'occupazione', 'lavoro', 'attivita lavorativa', 'condizione professionale', 'mestiere',
        'occupation', 'job', 'job title'] },

    // Valori ricavati dagli altri dati
    { k: 'nome_completo', e: 'Nome e cognome', calc: true, seg: 'NOME E COGNOME',
      sin: ['nome cognome', 'cognome nome', 'nominativo', 'nome completo', 'generalita', 'intestatario', 'name',
        'full name', 'fullname', 'sottoscritto', 'sottoscritta'] },
    { k: 'nome_completo_padre', e: 'Nome e cognome del padre', calc: true, rel: 'padre',
      sin: ['nome cognome padre', 'cognome nome padre', 'generalita padre'] },
    { k: 'nome_completo_madre', e: 'Nome e cognome della madre', calc: true, rel: 'madre',
      sin: ['nome cognome madre', 'cognome nome madre', 'generalita madre'] },
    { k: 'luogo_data_nascita', e: 'Luogo e data di nascita', calc: true,
      sin: ['luogo data nascita'] },
    { k: 'indirizzo_completo', e: 'Indirizzo completo', calc: true, seg: 'INDIRIZZO COMPLETO',
      sin: ['indirizzo completo', 'residenza completa', 'recapito completo'] },
    { k: 'luogo', e: 'Luogo (comune di residenza)', calc: true, doc: true, seg: 'LUOGO',
      sin: ['luogo', 'luogo firma', 'citta firma'] },
    { k: 'oggi', e: 'Data di oggi', calc: true, doc: true, seg: 'DATA',
      sin: ['data', 'data odierna', 'oggi', 'data oggi', 'data attuale', 'data firma', 'data compilazione'] },
    { k: 'luogo_data', e: 'Luogo e data di oggi', calc: true, doc: true, seg: 'LUOGO E DATA',
      sin: ['luogo data', 'data luogo'] },
  ],

  // Spazi da riempire nelle lettere («nato a ______»): parole che li precedono.
  // Le chiavi che iniziano con @ dipendono dal dato inserito subito prima.
  spazi: [
    ['sottoscritto', 'nome_completo'], ['sottoscritta', 'nome_completo'], ['sottoscritto a', 'nome_completo'],
    ['nome cognome', 'nome_completo'], ['cognome nome', 'nome_completo'], ['generalita', 'nome_completo'],
    ['nome', 'nome'], ['cognome', 'cognome'],
    ['nato a', 'luogo_nascita'], ['nata a', 'luogo_nascita'], ['nato a a', 'luogo_nascita'],
    ['luogo nascita', 'luogo_nascita'], ['comune nascita', 'luogo_nascita'],
    ['nato il', 'data_nascita'], ['nata il', 'data_nascita'], ['nato a il', 'data_nascita'], ['data nascita', 'data_nascita'],
    ['il', '@il'],
    ['figlio', 'nome_completo_padre'], ['figlia', 'nome_completo_padre'], ['figlio a', 'nome_completo_padre'],
    ['padre', 'nome_completo_padre'], ['madre', 'nome_completo_madre'],
    ['nome padre', 'nome_padre'], ['cognome padre', 'cognome_padre'], ['nome madre', 'nome_madre'], ['cognome madre', 'cognome_madre'],
    ['paternita', 'nome_padre'], ['maternita', 'nome_madre'],
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
    ['carta identita', 'numero_documento'], ['carta identita n', 'numero_documento'], ['passaporto n', 'numero_documento'],
    ['patente n', 'numero_documento'],
    ['rilasciato da', 'rilasciato_da'], ['rilasciata da', 'rilasciato_da'], ['rilasciato a da', 'rilasciato_da'],
    ['rilasciato dal comune', 'rilasciato_da'], ['rilasciata dal comune', 'rilasciato_da'],
    ['rilasciato il', 'data_rilascio'], ['rilasciata il', 'data_rilascio'], ['data rilascio', 'data_rilascio'],
    ['scadenza', 'scadenza_documento'], ['valido fino', 'scadenza_documento'], ['valida fino', 'scadenza_documento'],
    ['valido fino al', 'scadenza_documento'], ['valida fino al', 'scadenza_documento'],
    ['professione', 'professione'],
    ['li', 'oggi'], ['data', 'oggi'], ['luogo data', 'luogo_data'], ['luogo', 'luogo'],
  ],

  // Parole che non contano per riconoscere un campo.
  stop: ['di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dell', 'd', 'l', 'e', 'ed', 'of', 'the', 'your',
    's', 'tuo', 'tua', 'suo', 'sua', 'inserisci', 'inserire', 'indicare', 'indica', 'digita', 'scrivi', 'please', 'enter'],

  // Campi da non toccare mai.
  salta: ['utente', 'user', 'username', 'login', 'account', 'nickname', 'password', 'captcha', 'otp', 'coupon',
    'sconto', 'promo', 'promozionale', 'discount', 'voucher', 'cerca', 'ricerca', 'search', 'newsletter', 'file', 'allegato',
    'allegati', 'cvv', 'cvc'],

  // Campi che riguardano un'azienda o un ente, non la persona.
  org: ['azienda', 'aziendale', 'ditta', 'societa', 'impresa', 'organizzazione', 'company', 'business', 'datore',
    'scuola', 'istituto', 'struttura', 'negozio', 'fornitore', 'banca', 'filiale'],

  // Altre persone: per un profilo adulto e per un profilo di un minore (figlio, alunno).
  altriAdulto: ['coniuge', 'marito', 'moglie', 'figlio', 'figlia', 'figli', 'delegato', 'delegata', 'tutore',
    'beneficiario', 'beneficiaria', 'convivente', 'defunto', 'defunta', 'deceduto', 'deceduta', 'emergenza',
    'referente', 'alunno', 'alunna', 'alunni', 'studente', 'studentessa', 'minore', 'bambino', 'bambina',
    'neonato', 'neonata', 'familiare', 'nonno', 'nonna', 'fratello', 'sorella', 'testimone', 'partner', 'spouse',
    'child', 'emergency'],
  altriMinore: ['genitore', 'genitori', 'tutore', 'coniuge', 'marito', 'moglie', 'delegato', 'delegata',
    'beneficiario', 'beneficiaria', 'convivente', 'defunto', 'defunta', 'deceduto', 'deceduta', 'emergenza',
    'referente', 'dichiarante', 'richiedente', 'sottoscritto', 'sottoscritta', 'esercente', 'familiare', 'nonno',
    'nonna', 'fratello', 'sorella', 'testimone', 'partner', 'spouse', 'parent', 'guardian', 'emergency'],
  // Nelle lettere anche il destinatario è un'altra persona.
  altriDoc: ['destinatario', 'destinataria', 'spettabile', 'spett', 'egregio', 'gentile', 'gent', 'dirigente',
    'sindaco', 'responsabile', 'ufficio', 'avvocato', 'dott', 'dottor', 'dottore', 'medico', 'presidente',
    'direttore', 'assessore'],

  padre: ['padre', 'paternita', 'father', 'papa'],
  madre: ['madre', 'maternita', 'mother', 'mamma'],
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
