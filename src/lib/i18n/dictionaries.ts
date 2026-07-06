/**
 * UI string dictionaries for the in-app language toggle.
 *
 * `en` is the source of truth; `fr` must cover exactly the same keys (enforced by
 * the `Record<TKey, string>` type below). French is written for meaning, not
 * word-for-word: idiomatic phrasing a native speaker would use. House rules for
 * the French copy: no serial (Oxford) comma, and no em-dashes anywhere.
 *
 * Interpolation: use `{name}` placeholders, filled by `t(key, { name })`.
 * Counts that change wording use explicit `…One` / `…Other` key pairs.
 */

export const en = {
  // ── common ──
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.email': 'Email',
  'common.reload': "I've run it, reload",

  // ── nav ──
  'nav.home': 'Home',
  'nav.supplies': 'Supplies',
  'nav.add': 'Add',
  'nav.reorder': 'Reorder',
  'nav.profile': 'My Profile',
  'nav.peopleICareFor': 'People I Care For',
  'nav.sharing': 'Sharing',
  'nav.rotateSites': 'Rotate Sites',
  'nav.calendar': 'Calendar',
  'nav.devices': 'Devices',
  'nav.prescriptions': 'Prescriptions',
  'nav.appointments': 'Appointments',
  'nav.visitPrep': 'Visit prep',
  'nav.costs': 'Costs',
  'nav.medicalId': 'Medical ID',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign Out',
  'nav.more': 'More',

  // ── landing ──
  'landing.signIn': 'Sign in',
  'landing.badge': 'Daily safety support for type 1 diabetes',
  'landing.heroTitle': 'Your diabetes supply manager.',
  'landing.heroSub':
    'T1D Hub tracks your pods, sensors, reservoirs, and insulin, then tells you when to reorder, before you run low. Built for families living with type 1 diabetes.',
  'landing.getStarted': 'Get started',
  'landing.twoWays': 'Two ways to use T1D Hub',
  'landing.patientTitle': 'I manage my own supplies',
  'landing.patientBody':
    'Track your pods, sensors, reservoirs and insulin, and know exactly when to reorder, before you run low.',
  'landing.caregiverTitle': 'I care for someone with diabetes',
  'landing.caregiverBody':
    "Keep a calm eye on a loved one's supplies, and help them reorder before they run low, with the access they choose to give you.",
  'landing.whatYouGet': 'What you get',
  'landing.feat1Title': 'Proactive reorder timing',
  'landing.feat1Body':
    'See exactly when to reorder each supply, measured against your safety buffer and insurance refill window, not just when you hit zero.',
  'landing.feat2Title': 'Site rotation tracking',
  'landing.feat2Body':
    'Log infusion and injection sites on a body map so you rotate properly and give each spot time to rest.',
  'landing.feat3Title': 'Caregiver sharing',
  'landing.feat3Body':
    'Invite a parent or partner to view (and optionally help manage) your supplies, so no one runs low unnoticed.',
  'landing.feat4Title': 'Emergency medical ID',
  'landing.feat4Body':
    'An opt-in, read-only card a first responder can view on a locked phone, without logging in.',
  'landing.reassureTitle': 'Honest numbers, never guesses',
  'landing.reassureBody':
    "Every count and date comes from data you enter or scan. When something isn't known, the app says so. It never fabricates a supply level or an expiration date.",
  'landing.footerDisclaimer': 'Not a medical device. Does not provide glucose or dosing advice.',

  // ── login ──
  'login.signinTab': 'Sign in',
  'login.createTab': 'Create account',
  'login.subSignin': 'Sign in to your account',
  'login.subSignup': 'Create your account',
  'login.subForgot': 'Reset your password',
  'login.subMagic': 'Passwordless sign-in',
  'login.emailLabel': 'Email',
  'login.passwordLabel': 'Password',
  'login.forgotLink': 'Forgot password?',
  'login.signInBtn': 'Sign in',
  'login.emailMeLink': 'Email me a link instead',
  'login.confirmLabel': 'Confirm password',
  'login.confirmPlaceholder': 'Repeat your password',
  'login.min8': 'At least 8 characters.',
  'login.createBtn': 'Create account',
  'login.magicIntro': "We'll email you a one-time sign-in link. No password needed.",
  'login.sendMagic': 'Send magic link',
  'login.forgotIntro': "Enter your email and we'll send a link to reset your password.",
  'login.sendReset': 'Send reset link',
  'login.backToSignIn': 'Back to sign in',
  'login.footerEncrypted': 'Encrypted in transit',
  'login.footerYours': 'Your data stays yours',
  'login.or': 'or',
  'login.continueWithGoogle': 'Continue with Google',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.errMismatch': "Passwords don't match.",
  'login.errMin8': 'Password must be at least 8 characters.',
  'login.createdConfirm':
    'Account created! Check your inbox and click the confirmation link to finish signing in.',
  'login.magicSent': 'Magic link sent! Check your inbox.',
  'login.resetSent': 'Password reset link sent! Check your inbox. The link expires in 1 hour.',

  // ── reset password ──
  'reset.title': 'Set a new password',
  'reset.sub': 'Choose a strong password for your T1D Supply Hub account.',
  'reset.newPw': 'New password',
  'reset.confirmPw': 'Confirm new password',
  'reset.submit': 'Set new password',
  'reset.success': 'Password updated! Taking you to your dashboard…',

  // ── dashboard home ──
  'home.errTitle': "Couldn't load your supplies",
  'home.emptyTitle': "Let's get you set up",
  'home.emptyBody':
    "Add your first supply (a sensor, pod, reservoir, or vial) and we'll track how long it lasts and tell you when to reorder.",
  'home.addFirst': 'Add your first supply',
  'home.quickStart': 'Quick start',
  'home.quickStartBody': "Pick your pump and CGM, and we'll add your usual supplies in one tap.",
  'home.addManually': 'Or add one at a time',
  'home.allSet': "You're all set",
  'home.needAttentionOne': '{count} supply needs attention',
  'home.needAttentionOther': '{count} supplies need attention',
  'home.allSetSubOne': 'Your supply is above your {buffer}-day reserve.',
  'home.allSetSubOther': 'All {count} supplies are above your {buffer}-day reserve.',
  'home.needSub': 'Reorder soon to stay above your {buffer}-day reserve.',
  'home.unsetSubOne': 'Set a usage rate on 1 supply to track its runway.',
  'home.unsetSubOther': 'Set a usage rate on {count} supplies to track their runway.',
  'home.cardAllSupplies': 'All supplies',
  'home.cardTrackedOne': '{count} tracked',
  'home.cardTrackedOther': '{count} tracked',
  'home.cardReorder': 'Reorder',
  'home.cardToReorderOne': '{count} to reorder',
  'home.cardToReorderOther': '{count} to reorder',
  'home.nothingNeeded': 'Nothing needed',
  'home.addSupply': 'Add a supply',

  // ── onboarding (first-run) ──
  'onboarding.kicker': 'Welcome',
  'onboarding.title': 'Set up your supplies',
  'onboarding.subtitle':
    "Pick what you use and we'll add the usual supplies, with box sizes and how long each one lasts already filled in. You can change anything later.",
  'onboarding.delivery': 'Insulin delivery',
  'onboarding.cgm': 'Continuous glucose monitor',
  'onboarding.willAdd': "We'll add",
  'onboarding.perBox': '{n} per box',
  'onboarding.daysEach': '~{n} days each',
  'onboarding.pickPrompt': 'Pick what you use',
  'onboarding.finish': 'Add supplies and finish',
  'onboarding.skip': 'Skip for now',
  'onboarding.error': 'Could not finish setup. Please try again.',

  // ── supply status row (home + reorder) ──
  'row.outOfStock': 'Out of stock',
  'row.reorderSoon': 'Reorder soon',
  'row.wellStocked': 'Well stocked',
  'row.noneOnHand': 'None on hand',
  'row.daysLeftOne': '{count} day left',
  'row.daysLeftOther': '{count} days left',
  'row.reorder': 'Reorder',
  'row.unsetLabel': 'Usage not set',
  'row.unsetDays': 'set usage to see days left',

  // ── reorder page ──
  'reorder.kicker': 'Reorder',
  'reorder.title': 'What to reorder',
  'reorder.intro':
    "Only the supplies that would dip below your {buffer}-day reserve. Each button opens the supplier's reorder page. We never place an order for you.",
  'reorder.nothingTitle': 'Nothing to reorder',
  'reorder.nothingBody':
    'Everything you track is comfortably above your reserve. Check back when something runs low.',
  'reorder.viewAll': 'View all supplies',
  'reorder.distributorsTitle': 'Distributor shortcuts',
  'reorder.distributorsBody': 'Place or check on an order with a major DME supplier.',
  'reorder.unsetTitle': 'Not forecast yet',
  'reorder.unsetBody':
    'These have no usage rate, so their runway is unknown. Set one and they will show up here when it matters.',
  'reorder.setUsage': 'Set usage',

  // ── shared toasts ──
  'toast.openingSupplier': "Opening {label}'s reorder page in a new tab.",
  'toast.openingSearch': 'Opening a supplier search in a new tab.',

  // ── profile page ──
  'profile.kicker': 'Account',
  'profile.title': 'My profile',
  'profile.intro':
    'Your name, photo, and personal details. Medical and device details live in their own sections.',
  'profile.picture': 'Profile picture',
  'profile.changePhoto': 'Change photo',
  'profile.removePhoto': 'Remove',
  'profile.photoUpdated': 'Photo updated.',
  'profile.photoRemoved': 'Photo removed.',
  'profile.errImageType': 'Please choose an image file.',
  'profile.errImageSize': 'Image must be under 2 MB.',
  'profile.errUpload': "Couldn't upload. Please try again.",
  'profile.detailsTitle': 'Your details',
  'profile.preferredName': 'Preferred name',
  'profile.preferredNameHint': 'What we call you in the app.',
  'profile.pronouns': 'Pronouns',
  'profile.timezone': 'Time zone',
  'profile.timezoneDetect': 'Use my current time zone',
  'profile.saved': 'Profile saved.',
  'profile.medicalCardTitle': 'Diagnosis & emergency info',
  'profile.medicalCardBody': 'Blood type, allergies, and contacts, for your emergency card.',
  'profile.devicesCardTitle': 'Pump & CGM',
  'profile.devicesCardBody': 'The devices your supplies belong to.',
  'profile.manage': 'Manage',

  // ── settings ──
  'settings.kicker': 'Settings',
  'settings.title': 'Preferences',
  'settings.language': 'Language',
  'settings.languageBody': 'Choose the language for the app.',
  'settings.account': 'Account',
  'settings.displayName': 'Display name',
  'settings.optional': '(optional)',
  'settings.save': 'Save',
  'settings.nameSaved': 'Name saved.',
  'settings.setChangePw': 'Set / change password',
  'settings.newPw': 'New password',
  'settings.confirmNewPw': 'Confirm new password',
  'settings.updatePw': 'Update password',
  'settings.pwUpdated': 'Password updated.',
  'settings.signOut': 'Sign out',
  'settings.bufferTitle': 'Safety buffer',
  'settings.bufferBody':
    "Flag a supply as “reorder soon” while you still have this many days of reserve left, so you're never racing to zero.",
  'settings.daysReserve': 'days of reserve',
  'settings.daysUnit': 'days',
  'settings.pushTitle': 'Push notifications',
  'settings.pushBody':
    'The most useful alerts reach you when the app is closed (“Refill-eligible Thursday: tap to reorder”).',
  'settings.suppliersTitle': 'Supplier shortcuts',
  'settings.suppliersBody': 'Jump to a distributor to place or check on an order.',

  // ── account management (Phase C) ──
  'account.changeEmail': 'Change email',
  'account.newEmail': 'New email address',
  'account.sendEmailChange': 'Send confirmation',
  'account.emailChangeSent': 'Confirmation sent. Check BOTH your old and new inboxes to finish.',
  'account.exportTitle': 'Export my data',
  'account.exportBody': 'Download everything in your account as a single JSON file.',
  'account.exportBtn': 'Download my data',
  'account.exportDone': 'Your data was downloaded.',
  'account.exportErr': "Couldn't export your data. Please try again.",
  'account.dangerTitle': 'Delete account',
  'account.dangerBody':
    'Permanently delete your account and all your data: supplies, prescriptions, medical ID, sharing, everything. This cannot be undone.',
  'account.deleteBtn': 'Delete my account',
  'account.deleteConfirmTitle': 'Delete your account?',
  'account.deleteConfirmBody':
    'This permanently erases everything and cannot be undone. Type DELETE to confirm.',
  'account.deleteConfirmWord': 'DELETE',
  'account.deleteConfirmPlaceholder': 'Type DELETE',
  'account.deleteConfirmBtn': 'Permanently delete',
  'account.deleteErr': "Couldn't delete your account. Please try again.",

  // ── activity feed (Phase E) ──
  'activity.title': 'Recent activity',
  'activity.empty': 'Nothing yet. Your recent actions will show up here.',
  'activity.supplyAdded': 'Added {detail}',
  'activity.supplyUsed': 'Used one {detail}',
  'activity.supplyRestocked': 'Restocked {detail}',

  // ── analytics consent (Phase E) ──
  'analytics.title': 'Help improve the app',
  'analytics.body':
    'Share anonymous usage (which screens you open) to help improve T1D Hub. No health data, supply names, or personal info is ever included. Off by default. Change anytime.',
  'analytics.on': 'On',
  'analytics.off': 'Off',

  // ── parent safety view ──
  'safetyview.kicker': 'Parent safety view',
  'safetyview.caringFor': 'Caring for {name}',
  'safetyview.subtitle': "The current state, the next step, and who's responding, at a glance.",
  'safetyview.currentState': 'Current safety state',
  'safetyview.badgeGood': 'Good',
  'safetyview.badgeWatch': 'Watch',
  'safetyview.badgeAct': 'Act now',
  'safetyview.headlineGood': "Everything's covered.",
  'safetyview.headlineWatchOne': '{name} has 1 supply to reorder soon.',
  'safetyview.headlineWatchOther': '{name} has {count} supplies to reorder soon.',
  'safetyview.headlineActOne': '{name} is out of 1 supply.',
  'safetyview.headlineActOther': '{name} is out of {count} supplies.',
  'safetyview.supportGood': 'Nothing needs your attention right now. Check back anytime.',
  'safetyview.supportWatch': 'No emergency, but reorder soon to stay ahead.',
  'safetyview.supportAct': "Reorder now so they don't go without.",
  'safetyview.quickRead': 'Quick read',
  'safetyview.quickReadGood': 'Supplies are well stocked and on track.',
  'safetyview.quickReadWatch': 'Stable for now, but this needs watching.',
  'safetyview.quickReadAct': 'A supply has run out. Act to keep them covered.',
  'safetyview.tracked': 'Tracked',
  'safetyview.reorderSoon': 'Reorder soon',
  'safetyview.out': 'Out',
  'safetyview.mostUrgent': 'Most urgent',
  'safetyview.none': 'None',
  'safetyview.responder': 'Current responder',
  'safetyview.you': 'You',
  'safetyview.monitoringTitle': 'Live monitoring',
  'safetyview.monitoringNotConnected': 'Not connected',
  'safetyview.monitoringBody':
    "Live glucose / CGM monitoring isn't connected. This view tracks supplies and reorder timing. It doesn't show glucose.",
  'safetyview.suppliesTitle': 'Supplies',
  'safetyview.viewOnly': 'View only',
  'safetyview.manageRole': 'View & manage',
  'safetyview.empty': 'No supplies recorded yet.',
  'safetyview.loadErr': "Couldn't load this person's supplies.",
} as const

export type TKey = keyof typeof en

export const fr: Record<TKey, string> = {
  // ── common ──
  'common.loading': 'Chargement…',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.back': 'Retour',
  'common.email': 'E-mail',
  'common.reload': "C'est fait, actualiser",

  // ── nav ──
  'nav.home': 'Accueil',
  'nav.supplies': 'Fournitures',
  'nav.add': 'Ajouter',
  'nav.reorder': 'Recommander',
  'nav.profile': 'Mon profil',
  'nav.peopleICareFor': 'Personnes dont je prends soin',
  'nav.sharing': 'Partage',
  'nav.rotateSites': 'Rotation des sites',
  'nav.calendar': 'Calendrier',
  'nav.devices': 'Appareils',
  'nav.prescriptions': 'Ordonnances',
  'nav.appointments': 'Rendez-vous',
  'nav.visitPrep': 'Préparation visite',
  'nav.costs': 'Coûts',
  'nav.medicalId': 'Fiche médicale',
  'nav.settings': 'Paramètres',
  'nav.signOut': 'Se déconnecter',
  'nav.more': 'Plus',

  // ── landing ──
  'landing.signIn': 'Se connecter',
  'landing.badge': 'Un soutien quotidien pour le diabète de type 1',
  'landing.heroTitle': 'Votre gestionnaire de fournitures pour le diabète.',
  'landing.heroSub':
    "T1D Hub suit vos pods, capteurs, réservoirs et votre insuline, puis vous indique quand recommander, avant que vous ne soyez à court. Conçu pour les familles qui vivent avec le diabète de type 1.",
  'landing.getStarted': 'Commencer',
  'landing.twoWays': 'Deux façons d’utiliser T1D Hub',
  'landing.patientTitle': 'Je gère mes propres fournitures',
  'landing.patientBody':
    "Suivez vos pods, capteurs, réservoirs et votre insuline, et sachez exactement quand recommander, avant d’être à court.",
  'landing.caregiverTitle': 'J’accompagne une personne diabétique',
  'landing.caregiverBody':
    "Gardez un œil serein sur les fournitures d’un proche et aidez-le à recommander avant qu’il ne soit à court, avec l’accès qu’il choisit de vous accorder.",
  'landing.whatYouGet': 'Ce que vous obtenez',
  'landing.feat1Title': 'Le bon moment pour recommander',
  'landing.feat1Body':
    "Sachez exactement quand recommander chaque fourniture, en fonction de votre marge de sécurité et de votre fenêtre de renouvellement d’assurance, pas seulement une fois à zéro.",
  'landing.feat2Title': 'Suivi de la rotation des sites',
  'landing.feat2Body':
    "Notez vos sites de perfusion et d’injection sur une carte du corps pour bien alterner et laisser chaque zone se reposer.",
  'landing.feat3Title': 'Partage avec les proches',
  'landing.feat3Body':
    "Invitez un parent ou un partenaire à consulter vos fournitures (et, si vous le souhaitez, à aider à les gérer), pour que personne ne se retrouve à court sans le savoir.",
  'landing.feat4Title': 'Fiche médicale d’urgence',
  'landing.feat4Body':
    "Une fiche facultative, en lecture seule, qu’un secouriste peut consulter sur un téléphone verrouillé, sans connexion.",
  'landing.reassureTitle': 'Des chiffres honnêtes, jamais d’approximations',
  'landing.reassureBody':
    "Chaque quantité et chaque date provient des données que vous saisissez ou scannez. Quand une information est inconnue, l’application le dit. Elle n’invente jamais un niveau de stock ni une date de péremption.",
  'landing.footerDisclaimer':
    "Ce n’est pas un dispositif médical. N’offre aucun conseil de glycémie ni de dosage.",

  // ── login ──
  'login.signinTab': 'Se connecter',
  'login.createTab': 'Créer un compte',
  'login.subSignin': 'Connectez-vous à votre compte',
  'login.subSignup': 'Créez votre compte',
  'login.subForgot': 'Réinitialisez votre mot de passe',
  'login.subMagic': 'Connexion sans mot de passe',
  'login.emailLabel': 'E-mail',
  'login.passwordLabel': 'Mot de passe',
  'login.forgotLink': 'Mot de passe oublié ?',
  'login.signInBtn': 'Se connecter',
  'login.emailMeLink': 'M’envoyer plutôt un lien par e-mail',
  'login.confirmLabel': 'Confirmer le mot de passe',
  'login.confirmPlaceholder': 'Répétez votre mot de passe',
  'login.min8': 'Au moins 8 caractères.',
  'login.createBtn': 'Créer un compte',
  'login.magicIntro': 'Nous vous enverrons un lien de connexion à usage unique. Aucun mot de passe requis.',
  'login.sendMagic': 'Envoyer le lien magique',
  'login.forgotIntro':
    'Saisissez votre e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.',
  'login.sendReset': 'Envoyer le lien de réinitialisation',
  'login.backToSignIn': 'Retour à la connexion',
  'login.footerEncrypted': 'Chiffré pendant le transfert',
  'login.footerYours': 'Vos données restent les vôtres',
  'login.or': 'ou',
  'login.continueWithGoogle': 'Continuer avec Google',
  'login.showPassword': 'Afficher le mot de passe',
  'login.hidePassword': 'Masquer le mot de passe',
  'login.errMismatch': 'Les mots de passe ne correspondent pas.',
  'login.errMin8': 'Le mot de passe doit comporter au moins 8 caractères.',
  'login.createdConfirm':
    'Compte créé ! Consultez votre boîte de réception et cliquez sur le lien de confirmation pour terminer la connexion.',
  'login.magicSent': 'Lien magique envoyé ! Consultez votre boîte de réception.',
  'login.resetSent':
    'Lien de réinitialisation envoyé ! Consultez votre boîte de réception. Le lien expire dans 1 heure.',

  // ── reset password ──
  'reset.title': 'Définir un nouveau mot de passe',
  'reset.sub': 'Choisissez un mot de passe robuste pour votre compte T1D Supply Hub.',
  'reset.newPw': 'Nouveau mot de passe',
  'reset.confirmPw': 'Confirmer le nouveau mot de passe',
  'reset.submit': 'Définir le nouveau mot de passe',
  'reset.success': 'Mot de passe mis à jour ! Redirection vers votre tableau de bord…',

  // ── dashboard home ──
  'home.errTitle': 'Impossible de charger vos fournitures',
  'home.emptyTitle': 'Commençons la configuration',
  'home.emptyBody':
    "Ajoutez votre première fourniture (un capteur, un pod, un réservoir ou un flacon) et nous suivrons sa durée et vous indiquerons quand recommander.",
  'home.addFirst': 'Ajouter ma première fourniture',
  'home.quickStart': 'Démarrage rapide',
  'home.quickStartBody': "Choisissez votre pompe et votre CGM, et nous ajoutons vos fournitures habituelles en un geste.",
  'home.addManually': 'Ou ajoutez-les une par une',
  'home.allSet': 'Tout est en ordre',
  'home.needAttentionOne': '{count} fourniture nécessite votre attention',
  'home.needAttentionOther': '{count} fournitures nécessitent votre attention',
  'home.allSetSubOne': 'Votre fourniture est au-dessus de votre réserve de {buffer} jours.',
  'home.allSetSubOther': 'Vos {count} fournitures sont au-dessus de votre réserve de {buffer} jours.',
  'home.needSub': 'Recommandez bientôt pour rester au-dessus de votre réserve de {buffer} jours.',
  'home.unsetSubOne': "Renseignez l'usage d'une fourniture pour suivre son autonomie.",
  'home.unsetSubOther': "Renseignez l'usage de {count} fournitures pour suivre leur autonomie.",
  'home.cardAllSupplies': 'Toutes les fournitures',
  'home.cardTrackedOne': '{count} suivie',
  'home.cardTrackedOther': '{count} suivies',
  'home.cardReorder': 'Recommander',
  'home.cardToReorderOne': '{count} à recommander',
  'home.cardToReorderOther': '{count} à recommander',
  'home.nothingNeeded': 'Rien à faire',
  'home.addSupply': 'Ajouter une fourniture',

  // ── onboarding (first-run) ──
  'onboarding.kicker': 'Bienvenue',
  'onboarding.title': 'Configurez vos fournitures',
  'onboarding.subtitle':
    'Choisissez ce que vous utilisez et nous ajouterons les fournitures habituelles, avec la taille des boîtes et la durée de chaque unité déjà remplies. Vous pourrez tout modifier plus tard.',
  'onboarding.delivery': "Administration d'insuline",
  'onboarding.cgm': 'Capteur de glycémie en continu',
  'onboarding.willAdd': 'Nous ajouterons',
  'onboarding.perBox': '{n} par boîte',
  'onboarding.daysEach': '~{n} jours chacune',
  'onboarding.pickPrompt': 'Choisissez ce que vous utilisez',
  'onboarding.finish': 'Ajouter les fournitures et terminer',
  'onboarding.skip': "Passer pour l'instant",
  'onboarding.error': 'Impossible de terminer la configuration. Veuillez réessayer.',

  // ── supply status row ──
  'row.outOfStock': 'En rupture',
  'row.reorderSoon': 'À recommander bientôt',
  'row.wellStocked': 'Bien approvisionné',
  'row.noneOnHand': 'Aucune en stock',
  'row.daysLeftOne': '{count} jour restant',
  'row.daysLeftOther': '{count} jours restants',
  'row.reorder': 'Recommander',
  'row.unsetLabel': 'Usage non renseigné',
  'row.unsetDays': "renseignez l'usage pour voir les jours restants",

  // ── reorder page ──
  'reorder.kicker': 'Recommander',
  'reorder.title': 'À recommander',
  'reorder.intro':
    "Seules les fournitures qui passeraient sous votre réserve de {buffer} jours. Chaque bouton ouvre la page de commande du fournisseur. Nous ne passons jamais de commande à votre place.",
  'reorder.nothingTitle': 'Rien à recommander',
  'reorder.nothingBody':
    'Tout ce que vous suivez est confortablement au-dessus de votre réserve. Revenez quand quelque chose vient à manquer.',
  'reorder.viewAll': 'Voir toutes les fournitures',
  'reorder.distributorsTitle': 'Raccourcis distributeurs',
  'reorder.distributorsBody':
    "Passez ou suivez une commande auprès d’un grand distributeur de matériel médical.",
  'reorder.unsetTitle': 'Pas encore de prévision',
  'reorder.unsetBody':
    "Ces fournitures n'ont pas de rythme d'usage, leur autonomie est donc inconnue. Renseignez-le et elles apparaîtront ici au bon moment.",
  'reorder.setUsage': "Renseigner l'usage",

  // ── shared toasts ──
  'toast.openingSupplier': 'Ouverture de la page de commande de {label} dans un nouvel onglet.',
  'toast.openingSearch': "Ouverture d’une recherche de fournisseur dans un nouvel onglet.",

  // ── profile page ──
  'profile.kicker': 'Compte',
  'profile.title': 'Mon profil',
  'profile.intro':
    "Votre nom, votre photo et vos informations personnelles. Les détails médicaux et ceux des appareils se trouvent dans leurs propres sections.",
  'profile.picture': 'Photo de profil',
  'profile.changePhoto': 'Changer la photo',
  'profile.removePhoto': 'Supprimer',
  'profile.photoUpdated': 'Photo mise à jour.',
  'profile.photoRemoved': 'Photo supprimée.',
  'profile.errImageType': 'Veuillez choisir un fichier image.',
  'profile.errImageSize': "L’image doit faire moins de 2 Mo.",
  'profile.errUpload': "Échec de l’envoi. Veuillez réessayer.",
  'profile.detailsTitle': 'Vos informations',
  'profile.preferredName': "Prénom d’usage",
  'profile.preferredNameHint': "Le nom que nous utilisons dans l’application.",
  'profile.pronouns': 'Pronoms',
  'profile.timezone': 'Fuseau horaire',
  'profile.timezoneDetect': 'Utiliser mon fuseau horaire actuel',
  'profile.saved': 'Profil enregistré.',
  'profile.medicalCardTitle': "Diagnostic et infos d’urgence",
  'profile.medicalCardBody': "Groupe sanguin, allergies et contacts, pour votre fiche d’urgence.",
  'profile.devicesCardTitle': 'Pompe et CGM',
  'profile.devicesCardBody': 'Les appareils auxquels vos fournitures sont rattachées.',
  'profile.manage': 'Gérer',

  // ── settings ──
  'settings.kicker': 'Paramètres',
  'settings.title': 'Préférences',
  'settings.language': 'Langue',
  'settings.languageBody': "Choisissez la langue de l’application.",
  'settings.account': 'Compte',
  'settings.displayName': 'Nom affiché',
  'settings.optional': '(facultatif)',
  'settings.save': 'Enregistrer',
  'settings.nameSaved': 'Nom enregistré.',
  'settings.setChangePw': 'Définir / modifier le mot de passe',
  'settings.newPw': 'Nouveau mot de passe',
  'settings.confirmNewPw': 'Confirmer le nouveau mot de passe',
  'settings.updatePw': 'Mettre à jour le mot de passe',
  'settings.pwUpdated': 'Mot de passe mis à jour.',
  'settings.signOut': 'Se déconnecter',
  'settings.bufferTitle': 'Marge de sécurité',
  'settings.bufferBody':
    "Signalez une fourniture comme « à recommander bientôt » tant qu’il vous reste ce nombre de jours de réserve, pour ne jamais courir jusqu’à zéro.",
  'settings.daysReserve': 'jours de réserve',
  'settings.daysUnit': 'jours',
  'settings.pushTitle': 'Notifications push',
  'settings.pushBody':
    "Les alertes les plus utiles vous parviennent même lorsque l’application est fermée (« Renouvellement possible jeudi : appuyez pour recommander »).",
  'settings.suppliersTitle': 'Raccourcis fournisseurs',
  'settings.suppliersBody': 'Accédez à un distributeur pour passer ou suivre une commande.',

  // ── account management (Phase C) ──
  'account.changeEmail': "Changer d’e-mail",
  'account.newEmail': 'Nouvelle adresse e-mail',
  'account.sendEmailChange': 'Envoyer la confirmation',
  'account.emailChangeSent':
    "Confirmation envoyée. Vérifiez vos DEUX boîtes (ancienne et nouvelle) pour terminer.",
  'account.exportTitle': 'Exporter mes données',
  'account.exportBody': "Téléchargez tout le contenu de votre compte dans un seul fichier JSON.",
  'account.exportBtn': 'Télécharger mes données',
  'account.exportDone': 'Vos données ont été téléchargées.',
  'account.exportErr': "Impossible d’exporter vos données. Veuillez réessayer.",
  'account.dangerTitle': 'Supprimer le compte',
  'account.dangerBody':
    "Supprimez définitivement votre compte et toutes vos données : fournitures, ordonnances, fiche médicale, partages, tout. Cette action est irréversible.",
  'account.deleteBtn': 'Supprimer mon compte',
  'account.deleteConfirmTitle': 'Supprimer votre compte ?',
  'account.deleteConfirmBody':
    "Cela efface tout définitivement et ne peut pas être annulé. Tapez SUPPRIMER pour confirmer.",
  'account.deleteConfirmWord': 'SUPPRIMER',
  'account.deleteConfirmPlaceholder': 'Tapez SUPPRIMER',
  'account.deleteConfirmBtn': 'Supprimer définitivement',
  'account.deleteErr': "Impossible de supprimer votre compte. Veuillez réessayer.",

  // ── activity feed (Phase E) ──
  'activity.title': 'Activité récente',
  'activity.empty': "Rien pour l’instant. Vos actions récentes apparaîtront ici.",
  'activity.supplyAdded': 'Ajout de {detail}',
  'activity.supplyUsed': "Utilisation d’un(e) {detail}",
  'activity.supplyRestocked': 'Réapprovisionnement de {detail}',

  // ── analytics consent (Phase E) ──
  'analytics.title': "Aider à améliorer l’application",
  'analytics.body':
    "Partagez des statistiques d’usage anonymes (les écrans que vous ouvrez) pour aider à améliorer T1D Hub. Aucune donnée de santé, aucun nom de fourniture ni aucune information personnelle ne sont jamais inclus. Désactivé par défaut. Modifiable à tout moment.",
  'analytics.on': 'Activé',
  'analytics.off': 'Désactivé',

  // ── parent safety view ──
  'safetyview.kicker': 'Vue de sécurité parent',
  'safetyview.caringFor': 'Vous accompagnez {name}',
  'safetyview.subtitle': "L’état actuel, la prochaine étape et qui intervient, en un coup d’œil.",
  'safetyview.currentState': 'État de sécurité actuel',
  'safetyview.badgeGood': 'Bon',
  'safetyview.badgeWatch': 'À surveiller',
  'safetyview.badgeAct': 'Agir maintenant',
  'safetyview.headlineGood': 'Tout est couvert.',
  'safetyview.headlineWatchOne': '{name} a 1 fourniture à recommander bientôt.',
  'safetyview.headlineWatchOther': '{name} a {count} fournitures à recommander bientôt.',
  'safetyview.headlineActOne': "{name} est à court d’une fourniture.",
  'safetyview.headlineActOther': '{name} est à court de {count} fournitures.',
  'safetyview.supportGood': "Rien ne nécessite votre attention pour le moment. Revenez quand vous voulez.",
  'safetyview.supportWatch': "Pas d’urgence, mais recommandez bientôt pour garder une longueur d’avance.",
  'safetyview.supportAct': "Recommandez maintenant pour qu’il ou elle ne soit pas à court.",
  'safetyview.quickRead': 'Lecture rapide',
  'safetyview.quickReadGood': 'Les fournitures sont bien approvisionnées et sous contrôle.',
  'safetyview.quickReadWatch': "Stable pour l’instant, mais cela demande de la vigilance.",
  'safetyview.quickReadAct': "Une fourniture est épuisée. Agissez pour maintenir la couverture.",
  'safetyview.tracked': 'Suivies',
  'safetyview.reorderSoon': 'À recommander',
  'safetyview.out': 'En rupture',
  'safetyview.mostUrgent': 'Le plus urgent',
  'safetyview.none': 'Aucune',
  'safetyview.responder': 'Intervenant actuel',
  'safetyview.you': 'Vous',
  'safetyview.monitoringTitle': 'Surveillance en direct',
  'safetyview.monitoringNotConnected': 'Non connecté',
  'safetyview.monitoringBody':
    "La surveillance de la glycémie / CGM en direct n’est pas connectée. Cette vue suit les fournitures et le moment de recommander. Elle n’affiche pas la glycémie.",
  'safetyview.suppliesTitle': 'Fournitures',
  'safetyview.viewOnly': 'Lecture seule',
  'safetyview.manageRole': 'Voir et gérer',
  'safetyview.empty': 'Aucune fourniture enregistrée pour le moment.',
  'safetyview.loadErr': 'Impossible de charger les fournitures de cette personne.',
}
