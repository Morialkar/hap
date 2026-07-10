import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface I18nContextType {
  locale: 'fr' | 'en';
  setLocale: (locale: 'fr' | 'en') => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (date: Date | string, formatStr?: string) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const resources = {
  fr: {
    translation: {
      // Navigation
      'nav.home': 'Accueil',
      'nav.apiStatus': 'Statut API',
      'nav.workspaces': 'Espaces de travail',
      'nav.databases': 'Bases de données',
      'nav.tables': 'Tables',
      'nav.views': 'Vues',
      'nav.settings': 'Paramètres',
      'nav.logout': 'Déconnexion',
      'nav.toggle': 'Afficher ou masquer la navigation',
      'nav.primary': 'Navigation principale',
      'nav.changeLanguage': 'Passer à l’anglais',

      // Appearance
      'theme.customize': 'Personnaliser l’apparence',
      'theme.appearance': 'Mode',
      'theme.appearance.light': 'Clair',
      'theme.appearance.dark': 'Sombre',
      'theme.accent': 'Couleur d’accent',
      'theme.accent.heritage-green': 'Vert',
      'theme.accent.lime': 'Lime',
      'theme.accent.amber': 'Ambre',
      'theme.accent.orange': 'Orange',
      'theme.accent.red': 'Rouge',
      'theme.accent.rose': 'Rose',
      'theme.accent.magenta': 'Magenta',
      'theme.accent.violet': 'Violet',
      'theme.accent.indigo': 'Indigo',
      'theme.accent.blue': 'Bleu',
      'theme.accent.cyan': 'Cyan',
      'theme.accent.teal': 'Turquoise',

      // Auth
      'auth.login': 'Connexion',
      'auth.email': 'Courriel',
      'auth.password': 'Mot de passe',
      'auth.loginButton': 'Se connecter',
      'auth.logining': 'Connexion...',
      'auth.loginFailed': 'Échec de la connexion',
      'auth.logoutSuccess': 'Déconnexion réussie',

      // Common
      'common.loading': 'Chargement...',
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
      'common.delete': 'Supprimer',
      'common.edit': 'Modifier',
      'common.create': 'Créer',
      'common.search': 'Rechercher',
      'common.filter': 'Filtrer',
      'common.sort': 'Trier',
      'common.actions': 'Actions',
      'common.add': 'Ajouter',
      'common.remove': 'Retirer',
      'common.configure': 'Configurer',
      'common.reorder': 'Réordonner',
      'common.preview': 'Aperçu',
      'common.details': 'Détails',
      'common.confirm': 'Confirmer',
      'common.back': 'Retour',
      'common.next': 'Suivant',
      'common.previous': 'Précédent',
      'common.close': 'Fermer',
      'common.yes': 'Oui',
      'common.no': 'Non',

      // Builder
      'builder.tabs.structure': 'Structure',
      'builder.tabs.layout': 'Disposition',
      'layout.title': 'Éditeur de disposition',
      'layout.selectView': 'Choisir une vue',
      'layout.isDefault': 'Disposition par défaut pour la navigation',
      'layout.defaultSetSuccess': 'Disposition par défaut mise à jour !',
      'navigation.filterByField': 'Filtrer par champ',
      'navigation.filterValue': 'Valeur',
      'navigation.all': 'Tous',
      'layout.newView': 'Nouvelle vue de carte',
      'layout.newView.placeholder': 'Nom de la vue (ex. Aperçu Principal)',
      'layout.columns.label': 'Nombre de colonnes',
      'layout.columns.option_one': '{{count}} colonne',
      'layout.columns.option_other': '{{count}} colonnes',
      'layout.unassignedFields.title': 'Champs non assignés',
      'layout.unassignedFields.empty': 'Tous les champs sont dans la disposition.',
      'layout.column.title': 'Colonne {{number}}',
      'layout.column.empty': 'Déposez des champs ici.',
      'layout.saveLayout': 'Enregistrer la disposition',
      'layout.saveSuccess': 'Disposition enregistrée avec succès !',
      'builder.title': 'Éditeur de structure',
      'builder.subtitle.database': 'Base de données',
      'builder.subtitle.table': 'Table',
      'builder.palette.title': 'Types de champs',
      'builder.palette.dragHint': "Glissez un type ici pour l'ajouter",
      'builder.canvas.title': 'Formulaire',
      'builder.canvas.empty': 'Aucun champ. Faites glisser un type depuis la palette.',
      'builder.fieldName.label': 'Nom du champ',
      // Records
      'records.title': 'Fiches',
      'records.add': 'Ajouter une fiche',
      'records.edit': 'Modifier la fiche',
      'records.duplicate': 'Dupliquer la fiche',
      'records.empty': 'Aucune fiche dans cette table.',
      'records.empty.title': 'Aucune fiche pour le moment',
      'records.empty.description':
        'Créez une première fiche pour commencer à documenter cette collection.',
      'records.saveAndAddAnother': 'Enregistrer et ajouter un autre',
      'records.unsavedChanges':
        'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?',
      'records.charCounter': '{{count}} / {{max}} caractères',
      'records.upload.hint': 'Glissez-déposez des fichiers ici ou cliquez pour choisir',
      'records.upload.invalidType': 'Type de fichier non supporté.',
      'records.upload.invalidSize': 'Fichier trop volumineux (max {{max}} Mo).',
      'records.inlineCreate.title': 'Créer une référence',
      // List & Detail Views
      'records.search': 'Rechercher...',
      'records.groupBy': 'Grouper par',
      'records.noGrouping': 'Aucun regroupement',
      'records.sortBy': 'Trier par',
      'records.filter.add': 'Ajouter un filtre',
      'records.filter.field': 'Champ',
      'records.filter.operator': 'Opérateur',
      'records.filter.value': 'Valeur',
      'records.filter.apply': 'Appliquer les filtres',
      'records.deleteConflict.title': 'Conflit de suppression',
      'records.deleteConflict.text':
        "Cette fiche est référencée {{count}} fois par d'autres fiches (ex: {{tables}}). Veuillez réassigner ces références vers une autre fiche avant de pouvoir la supprimer.",
      'records.deleteConflict.target': 'Fiche de destination (remplacement)',
      'records.deleteConflict.submit': 'Réassigner et supprimer',
      'records.trash.title': 'Corbeille',
      'records.trash.empty': 'Aucun élément dans la corbeille.',
      'records.trash.restore': 'Restaurer',
      'records.trash.purge': 'Purger définitivement',
      'records.history.title': 'Historique des versions',
      'records.history.empty': 'Aucun historique pour cette fiche.',
      'records.history.restore': 'Restaurer cette version',
      'records.history.action.create': 'Création de la fiche',
      'records.history.action.update': 'Mise à jour',
      'records.history.action.delete': 'Suppression',
      'records.history.action.restore': 'Restauration',
      'records.history.diff.added': 'Champ ajouté',
      'records.history.diff.changed': 'Champ modifié',
      'records.history.diff.removed': 'Champ supprimé',
      'builder.fieldName.placeholder': "ex. Titre de l'œuvre",
      'builder.fieldType.label': 'Type de champ',
      'builder.options.title': 'Options du champ',
      'builder.options.noOptions': 'Aucune option configurable pour ce type.',
      'builder.validation.title': 'Règles de validation',
      'builder.validation.noRules': 'Aucune règle pour ce type.',
      'builder.saveDraft.label': 'Brouillon enregistré automatiquement',
      'builder.destructive.title': 'Changement destructif',
      'builder.destructive.affectedRecords_one': '{{count}} fiche concernée',
      'builder.destructive.affectedRecords_other': '{{count}} fiches concernées',
      'builder.destructive.orphanedValues_one': '{{count}} valeur orpheline sera conservée',
      'builder.destructive.orphanedValues_other': '{{count}} valeurs orphelines seront conservées',
      'builder.destructive.confirmLabel': 'Confirmer la modification',
      'builder.destructive.coercionRequired': 'Conversion des valeurs requise',
      'workspaces.newDatabase.placeholder': 'Nouvelle base de données',
      'workspaces.newTable.placeholder': 'Nouvelle table',
      'workspaces.empty.message': 'Aucune base de données. Créez-en une pour commencer.',
      'workspaces.empty.title': 'Aucune base de données',
      'workspaces.tables.count': 'table(s)',
      'workspaces.tables.empty': 'Aucune table',
      'workspaces.builder.action': 'Éditeur de structure',
      'workspaces.table.isFrontFacing': 'De façade',
      'builder.isFrontFacing': 'Table de façade',
      'nav.navigation': 'Navigation',
      'navigation.emptyState.title': 'Aucune table de façade',
      'navigation.emptyState.description':
        'Activez l’option « De façade » sur une ou plusieurs tables pour les afficher dans ce mode.',
      'navigation.searchPlaceholder': 'Rechercher...',
      'navigation.sortBy': 'Trier par',
      'navigation.sortDir.asc': 'Croissant',
      'navigation.sortDir.desc': 'Décroissant',
      'navigation.columnsCount': 'Colonnes de fiches',
      'navigation.browse': 'Naviguer',
      'workspaces.createFromTemplate': 'Créer à partir d’un modèle',
      'workspaces.selectTemplate': 'Sélectionner un modèle',
      'workspaces.template.literary': 'Catalogue Littéraire (Éusèbe)',
      'workspaces.template.recipe': 'Boîte à Recettes',
      'workspaces.install': 'Installer le modèle',
      'workspaces.installing': 'Installation du modèle...',
      'workspaces.installSuccess': 'Le modèle a été installé avec succès !',
      'builder.destructive.typeChangeMessage':
        "Changer le type risque d'altérer des données. Voulez-vous continuer ?",
      'builder.destructive.deleteMessage': 'Supprimer ce champ détachera ces données. Continuer?',
      'fieldType.title.label': 'Titre',
      'fieldType.title.description': 'Champ de titre principal pour la fiche.',
      'fieldType.isFilterable': 'Permettre le filtrage avec ce champ',
      'fieldType.text.label': 'Texte court',
      'fieldType.text.description': 'Texte sur une ligne avec limite de longueur.',
      'fieldType.text.options.maxLength': 'Longueur maximale',
      'fieldType.text.options.placeholder': 'Texte indicatif',
      'fieldType.text.options.showCharCount': 'Afficher le compteur de caractères',
      'fieldType.longText.label': 'Texte long',
      'fieldType.longText.description': 'Plusieurs lignes de texte.',
      'fieldType.longText.options.rows': 'Nombre de lignes affichées',
      'fieldType.longText.options.maxLength': 'Longueur maximale',
      'fieldType.number.label': 'Nombre',
      'fieldType.number.description': 'Valeur numérique avec min/max/pas.',
      'fieldType.number.options.min': 'Valeur minimale',
      'fieldType.number.options.max': 'Valeur maximale',
      'fieldType.number.options.step': 'Pas',
      'fieldType.number.options.decimals': 'Décimales',
      'fieldType.date.label': 'Date',
      'fieldType.date.description': 'Date, optionnellement avec heure.',
      'fieldType.date.options.includeTime': "Inclure l'heure",
      'fieldType.date.options.allowPartial': 'Autoriser les dates incomplètes',
      'fieldType.date.validation.minDate': 'Date minimale',
      'fieldType.date.validation.maxDate': 'Date maximale',
      'fieldType.boolean.label': 'Case à cocher',
      'fieldType.boolean.description': 'Vrai/faux.',
      'fieldType.boolean.options.defaultValue': 'Valeur par défaut',
      'fieldType.boolean.options.unset': 'Non défini',
      'fieldType.boolean.options.true': 'Coché',
      'fieldType.boolean.options.false': 'Non coché',
      'fieldType.select.label': 'Liste déroulante',
      'fieldType.select.description': 'Choisir une ou plusieurs valeurs parmi une liste.',
      'fieldType.select.options.values': 'Valeurs possibles (une par ligne)',
      'fieldType.select.options.multi': 'Sélection multiple',
      'fieldType.select.options.allowOther': 'Autoriser une valeur hors liste',
      'fieldType.reference.label': 'Référence',
      'fieldType.reference.description': 'Lien vers une autre fiche.',
      'fieldType.reference.options.targetTable': 'Table cible',
      'fieldType.reference.options.multi': 'Références multiples',
      'fieldType.reference.options.displayField': 'Champ à afficher',
      'fieldType.image.label': 'Image',
      'fieldType.image.description': 'Image avecaperçu.',
      'fieldType.image.options.multi': 'Plusieurs images',
      'fieldType.image.options.maxSizeMB': 'Taille maximale (Mo)',
      'fieldType.image.options.acceptedTypes': 'Types acceptés (séparés par des virgules)',
      'fieldType.file.label': 'Fichier',
      'fieldType.file.description': 'Fichier à joindre.',
      'fieldType.file.options.multi': 'Plusieurs fichiers',
      'fieldType.file.options.maxSizeMB': 'Taille maximale (Mo)',
      'fieldType.file.options.acceptedTypes': 'Extensions acceptées (séparées par des virgules)',
      'fieldType.url.label': 'URL',
      'fieldType.url.description': 'Adresse Web.',
      'fieldType.email.label': 'Courriel',
      'fieldType.email.description': 'Adresse électronique.',
      'fieldType.gps.label': 'GPS',
      'fieldType.gps.description': 'Coordonnées latitude et longitude.',
      'fieldType.validation.required': 'Obligatoire',
      'fieldType.validation.minLength': 'Longueur minimale',
      'fieldType.validation.maxLength': 'Longueur maximale',
      'fieldType.validation.pattern': 'Expression régulière',
      'fieldType.validation.minDate': 'Date minimale',
      'fieldType.validation.maxDate': 'Date maximale',

      // Errors
      'error.title': 'Erreur',
      'error.notFound': 'Page non trouvée',
      'error.unauthorized': 'Non autorisé',
      'error.serverError': 'Erreur serveur',
      'error.networkError': 'Erreur réseau',
      'error.tryAgain': 'Réessayer',

      // Date formats
      'date.full': 'dd MMMM yyyy',
      'date.short': 'dd/MM/yyyy',
      'date.time': 'dd/MM/yyyy HH:mm',
      'date.relative': 'il y a {{time}}',
    },
  },
  en: {
    translation: {
      // Navigation
      'nav.home': 'Home',
      'nav.apiStatus': 'API Status',
      'nav.workspaces': 'Workspaces',
      'nav.databases': 'Databases',
      'nav.tables': 'Tables',
      'nav.views': 'Views',
      'nav.settings': 'Settings',
      'nav.logout': 'Logout',
      'nav.toggle': 'Toggle navigation',
      'nav.primary': 'Primary navigation',
      'nav.changeLanguage': 'Switch to French',

      // Appearance
      'theme.customize': 'Customize appearance',
      'theme.appearance': 'Mode',
      'theme.appearance.light': 'Light',
      'theme.appearance.dark': 'Dark',
      'theme.accent': 'Accent color',
      'theme.accent.heritage-green': 'Heritage green',
      'theme.accent.lime': 'Lime',
      'theme.accent.amber': 'Amber',
      'theme.accent.orange': 'Orange',
      'theme.accent.red': 'Red',
      'theme.accent.rose': 'Rose',
      'theme.accent.magenta': 'Magenta',
      'theme.accent.violet': 'Violet',
      'theme.accent.indigo': 'Indigo',
      'theme.accent.blue': 'Blue',
      'theme.accent.cyan': 'Cyan',
      'theme.accent.teal': 'Teal',

      // Auth
      'auth.login': 'Login',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.loginButton': 'Sign In',
      'auth.logining': 'Signing in...',
      'auth.loginFailed': 'Login failed',
      'auth.logoutSuccess': 'Logout successful',

      // Common
      'common.loading': 'Loading...',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.create': 'Create',
      'common.search': 'Search',
      'common.filter': 'Filter',
      'common.sort': 'Sort',
      'common.actions': 'Actions',
      'common.add': 'Add',
      'common.remove': 'Remove',
      'common.configure': 'Configure',
      'common.reorder': 'Reorder',
      'common.preview': 'Preview',
      'common.details': 'Details',
      'common.confirm': 'Confirm',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.previous': 'Previous',
      'common.close': 'Close',
      'common.yes': 'Yes',
      'common.no': 'No',

      // Builder
      'builder.tabs.structure': 'Structure',
      'builder.tabs.layout': 'Layout',
      'layout.title': 'Card Layout Editor',
      'layout.selectView': 'Select a view',
      'layout.isDefault': 'Default layout for navigation',
      'layout.defaultSetSuccess': 'Default layout updated!',
      'navigation.filterByField': 'Filter by field',
      'navigation.filterValue': 'Value',
      'navigation.all': 'All',
      'layout.newView': 'New card view',
      'layout.newView.placeholder': 'View name (e.g. Main Card)',
      'layout.columns.label': 'Number of columns',
      'layout.columns.option_one': '{{count}} column',
      'layout.columns.option_other': '{{count}} columns',
      'layout.unassignedFields.title': 'Unassigned Fields',
      'layout.unassignedFields.empty': 'All fields are placed in the layout.',
      'layout.column.title': 'Column {{number}}',
      'layout.column.empty': 'Drop fields here.',
      'layout.saveLayout': 'Save Layout',
      'layout.saveSuccess': 'Layout saved successfully!',
      'builder.title': 'Structure Editor',
      'builder.subtitle.database': 'Database',
      'builder.subtitle.table': 'Table',
      'builder.palette.title': 'Field Types',
      'builder.palette.dragHint': 'Drag a type here to add it',
      'builder.canvas.title': 'Form',
      'builder.canvas.empty': 'No fields yet. Drag a type from the palette.',
      'builder.fieldName.label': 'Field name',
      // Records
      'records.title': 'Records',
      'records.add': 'Add Record',
      'records.edit': 'Edit Record',
      'records.duplicate': 'Duplicate Record',
      'records.empty': 'No records in this table.',
      'records.empty.title': 'No records yet',
      'records.empty.description': 'Create the first record to begin documenting this collection.',
      'records.saveAndAddAnother': 'Save & Add Another',
      'records.unsavedChanges': 'You have unsaved changes. Are you sure you want to leave?',
      'records.charCounter': '{{count}} / {{max}} characters',
      'records.upload.hint': 'Drag & drop files here or click to browse',
      'records.upload.invalidType': 'Unsupported file type.',
      'records.upload.invalidSize': 'File is too large (max {{max}} MB).',
      'records.inlineCreate.title': 'Create Reference',
      // List & Detail Views
      'records.search': 'Search...',
      'records.groupBy': 'Group by',
      'records.noGrouping': 'No grouping',
      'records.sortBy': 'Sort by',
      'records.filter.add': 'Add filter',
      'records.filter.field': 'Field',
      'records.filter.operator': 'Operator',
      'records.filter.value': 'Value',
      'records.filter.apply': 'Apply filters',
      'records.deleteConflict.title': 'Delete Conflict',
      'records.deleteConflict.text':
        'This record is referenced {{count}} times by other records (e.g. {{tables}}). Please reassign these references to another record before deleting.',
      'records.deleteConflict.target': 'Target record (replacement)',
      'records.deleteConflict.submit': 'Reassign & Delete',
      'records.trash.title': 'Trash Bin',
      'records.trash.empty': 'No items in the trash.',
      'records.trash.restore': 'Restore',
      'records.trash.purge': 'Purge permanently',
      'records.history.title': 'Version History',
      'records.history.empty': 'No history log for this record.',
      'records.history.restore': 'Restore this version',
      'records.history.action.create': 'Record created',
      'records.history.action.update': 'Updated',
      'records.history.action.delete': 'Deleted',
      'records.history.action.restore': 'Restored',
      'records.history.diff.added': 'Field added',
      'records.history.diff.changed': 'Field changed',
      'records.history.diff.removed': 'Field removed',
      'builder.fieldName.placeholder': 'e.g. Work title',
      'builder.fieldType.label': 'Field type',
      'builder.options.title': 'Field options',
      'builder.options.noOptions': 'No configurable options for this type.',
      'builder.validation.title': 'Validation rules',
      'builder.validation.noRules': 'No rules for this type.',
      'builder.saveDraft.label': 'Autosaved draft',
      'builder.destructive.title': 'Destructive change',
      'builder.destructive.affectedRecords_one': '{{count}} record affected',
      'builder.destructive.affectedRecords_other': '{{count}} records affected',
      'builder.destructive.orphanedValues_one': '{{count}} orphaned value will be retained',
      'builder.destructive.orphanedValues_other': '{{count}} orphaned values will be retained',
      'builder.destructive.confirmLabel': 'Confirm change',
      'builder.destructive.coercionRequired': 'Value coercion required',
      'workspaces.newDatabase.placeholder': 'New database',
      'workspaces.newTable.placeholder': 'New table',
      'workspaces.empty.message': 'No databases yet. Create one to get started.',
      'workspaces.empty.title': 'No databases yet',
      'workspaces.tables.count': 'table(s)',
      'workspaces.tables.empty': 'No tables',
      'workspaces.builder.action': 'Structure editor',
      'workspaces.table.isFrontFacing': 'Front facing',
      'builder.isFrontFacing': 'Front facing table',
      'nav.navigation': 'Navigation',
      'navigation.emptyState.title': 'No front-facing tables',
      'navigation.emptyState.description':
        'Enable the "Front facing" option on one or more tables to view them in this mode.',
      'navigation.searchPlaceholder': 'Search...',
      'navigation.sortBy': 'Sort by',
      'navigation.sortDir.asc': 'Ascending',
      'navigation.sortDir.desc': 'Descending',
      'navigation.columnsCount': 'Card columns',
      'navigation.browse': 'Browse',
      'workspaces.createFromTemplate': 'Create from template',
      'workspaces.selectTemplate': 'Select a template',
      'workspaces.template.literary': 'Literary Catalog (Éusèbe)',
      'workspaces.template.recipe': 'Recipe Box',
      'workspaces.install': 'Install template',
      'workspaces.installing': 'Installing template...',
      'workspaces.installSuccess': 'Template installed successfully!',
      'builder.destructive.typeChangeMessage':
        'Changing the type may alter existing data. Continue?',
      'builder.destructive.deleteMessage':
        'Deleting this field will detach existing data. Continue?',
      'fieldType.title.label': 'Title',
      'fieldType.title.description': 'Main title field for the card.',
      'fieldType.isFilterable': 'Enable filtering with this field',
      'fieldType.text.label': 'Short text',
      'fieldType.text.description': 'Single-line text input with length limit.',
      'fieldType.text.options.maxLength': 'Maximum length',
      'fieldType.text.options.placeholder': 'Placeholder text',
      'fieldType.text.options.showCharCount': 'Show character counter',
      'fieldType.longText.label': 'Long text',
      'fieldType.longText.description': 'Multi-line text.',
      'fieldType.longText.options.rows': 'Visible rows',
      'fieldType.longText.options.maxLength': 'Maximum length',
      'fieldType.number.label': 'Number',
      'fieldType.number.description': 'Numeric value with min/max/step.',
      'fieldType.number.options.min': 'Minimum value',
      'fieldType.number.options.max': 'Maximum value',
      'fieldType.number.options.step': 'Step',
      'fieldType.number.options.decimals': 'Decimals',
      'fieldType.date.label': 'Date',
      'fieldType.date.description': 'Date, optionally with time.',
      'fieldType.date.options.includeTime': 'Include time',
      'fieldType.date.options.allowPartial': 'Allow partial dates',
      'fieldType.date.validation.minDate': 'Minimum date',
      'fieldType.date.validation.maxDate': 'Maximum date',
      'fieldType.boolean.label': 'Checkbox',
      'fieldType.boolean.description': 'True/false.',
      'fieldType.boolean.options.defaultValue': 'Default value',
      'fieldType.boolean.options.unset': 'Unset',
      'fieldType.boolean.options.true': 'Checked',
      'fieldType.boolean.options.false': 'Unchecked',
      'fieldType.select.label': 'Select',
      'fieldType.select.description': 'Choose one or more values from a list.',
      'fieldType.select.options.values': 'Allowed values (one per line)',
      'fieldType.select.options.multi': 'Multi-select',
      'fieldType.select.options.allowOther': 'Allow values outside list',
      'fieldType.reference.label': 'Reference',
      'fieldType.reference.description': 'Link to another record.',
      'fieldType.reference.options.targetTable': 'Target table',
      'fieldType.reference.options.multi': 'Multiple references',
      'fieldType.reference.options.displayField': 'Field to display',
      'fieldType.image.label': 'Image',
      'fieldType.image.description': 'Image with preview.',
      'fieldType.image.options.multi': 'Multiple images',
      'fieldType.image.options.maxSizeMB': 'Max size (MB)',
      'fieldType.image.options.acceptedTypes': 'Accepted MIME types (comma-separated)',
      'fieldType.file.label': 'File',
      'fieldType.file.description': 'Attached file.',
      'fieldType.file.options.multi': 'Multiple files',
      'fieldType.file.options.maxSizeMB': 'Max size (MB)',
      'fieldType.file.options.acceptedTypes': 'Accepted extensions (comma-separated)',
      'fieldType.url.label': 'URL',
      'fieldType.url.description': 'Web address.',
      'fieldType.email.label': 'Email',
      'fieldType.email.description': 'Email address.',
      'fieldType.gps.label': 'GPS',
      'fieldType.gps.description': 'Latitude and longitude coordinates.',
      'fieldType.validation.required': 'Required',
      'fieldType.validation.minLength': 'Minimum length',
      'fieldType.validation.maxLength': 'Maximum length',
      'fieldType.validation.pattern': 'Regular expression',
      'fieldType.validation.minDate': 'Minimum date',
      'fieldType.validation.maxDate': 'Maximum date',

      // Errors
      'error.title': 'Error',
      'error.notFound': 'Page not found',
      'error.unauthorized': 'Unauthorized',
      'error.serverError': 'Server error',
      'error.networkError': 'Network error',
      'error.tryAgain': 'Try again',

      // Date formats
      'date.full': 'MMMM dd, yyyy',
      'date.short': 'MM/dd/yyyy',
      'date.time': 'MM/dd/yyyy HH:mm',
      'date.relative': '{{time}} ago',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: window.__APP__?.locale || 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<'fr' | 'en'>(
    (window.__APP__?.locale as 'fr' | 'en') || 'fr'
  );

  const setLocale = useCallback((newLocale: 'fr' | 'en') => {
    setLocaleState(newLocale);
    i18n.changeLanguage(newLocale);
    try {
      window.localStorage?.setItem('locale', newLocale);
    } catch {
      // localStorage may not be available in SSR/test environments
    }
  }, []);

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
    try {
      const savedLocale = window.localStorage?.getItem('locale') as 'fr' | 'en' | null;
      if (savedLocale && savedLocale !== locale) {
        setLocale(savedLocale);
      }
    } catch {
      // localStorage may not be available in SSR/test environments
    }
  }, [locale, setLocale]);

  const formatDate = (date: Date | string, formatStr?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const localeObj = locale === 'fr' ? fr : enUS;
    const formatString = formatStr || i18n.t('date.full');
    return format(dateObj, formatString, { locale: localeObj });
  };

  const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, options).format(number);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: i18n.t,
        formatDate,
        formatNumber,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
