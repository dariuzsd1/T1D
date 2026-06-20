/**
 * UI string dictionaries for the in-app language toggle.
 *
 * `en` is the source of truth; `fr` must cover exactly the same keys (enforced by
 * the `Record<TKey, string>` type below). French is written for *meaning*, not
 * word-for-word — idiomatic phrasing a native speaker would use.
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
  'common.reload': "I've run it — reload",

  // ── nav ──
  'nav.home': 'Home',
  'nav.supplies': 'Supplies',
  'nav.add': 'Add',
  'nav.reorder': 'Reorder',
  'nav.peopleICareFor': 'People I care for',
  'nav.sharing': 'Sharing',
  'nav.rotateSites': 'Rotate sites',
  'nav.calendar': 'Calendar',
  'nav.devices': 'Devices',
  'nav.prescriptions': 'Prescriptions',
  'nav.appointments': 'Appointments',
  'nav.costs': 'Costs',
  'nav.medicalId': 'Medical ID',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign out',
  'nav.more': 'More',

  // ── landing ──
  'landing.signIn': 'Sign in',
  'landing.badge': 'Daily safety support for type 1 diabetes',
  'landing.heroTitle': 'Never run out of diabetes supplies again.',
  'landing.heroSub':
    'T1D Hub tracks your pods, sensors, reservoirs, and insulin — and tells you when to reorder, before you run low. Built for families living with type 1 diabetes.',
  'landing.getStarted': 'Get started',
  'landing.twoWays': 'Two ways to use T1D Hub',
  'landing.patientTitle': 'I manage my own supplies',
  'landing.patientBody':
    'Track your pods, sensors, reservoirs and insulin, and know exactly when to reorder — before you run low.',
  'landing.caregiverTitle': 'I care for someone with diabetes',
  'landing.caregiverBody':
    "Keep a calm eye on a loved one's supplies, and help them reorder before they run low — with the access they choose to give you.",
  'landing.whatYouGet': 'What you get',
  'landing.feat1Title': 'Proactive reorder timing',
  'landing.feat1Body':
    'See exactly when to reorder each supply — measured against your safety buffer and insurance refill window, not just when you hit zero.',
  'landing.feat2Title': 'Site rotation tracking',
  'landing.feat2Body':
    'Log infusion and injection sites on a body map so you rotate properly and give each spot time to rest.',
  'landing.feat3Title': 'Caregiver sharing',
  'landing.feat3Body':
    'Invite a parent or partner to view — and optionally help manage — supplies, so no one runs low unnoticed.',
  'landing.feat4Title': 'Emergency medical ID',
  'landing.feat4Body':
    'An opt-in, read-only card a first responder can view on a locked phone, without logging in.',
  'landing.reassureTitle': 'Honest numbers, never guesses',
  'landing.reassureBody':
    "Every count and date comes from data you enter or scan. When something isn't known, the app says so — it never fabricates a supply level or an expiration.",
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
  'login.magicIntro': "We'll email you a one-time sign-in link — no password needed.",
  'login.sendMagic': 'Send magic link',
  'login.forgotIntro': "Enter your email and we'll send a link to reset your password.",
  'login.sendReset': 'Send reset link',
  'login.backToSignIn': 'Back to sign in',
  'login.footerEncrypted': 'Encrypted in transit',
  'login.footerYours': 'Your data stays yours',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.errMismatch': "Passwords don't match.",
  'login.errMin8': 'Password must be at least 8 characters.',
  'login.createdConfirm':
    'Account created! Check your inbox and click the confirmation link to finish signing in.',
  'login.magicSent': 'Magic link sent! Check your inbox.',
  'login.resetSent': 'Password reset link sent! Check your inbox — the link expires in 1 hour.',

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
    "Add your first supply — a sensor, pod, reservoir, or vial — and we'll track how long it lasts and tell you when to reorder.",
  'home.addFirst': 'Add your first supply',
  'home.allSet': "You're all set",
  'home.needAttentionOne': '{count} supply needs attention',
  'home.needAttentionOther': '{count} supplies need attention',
  'home.allSetSubOne': 'Your supply is above your {buffer}-day reserve.',
  'home.allSetSubOther': 'All {count} supplies are above your {buffer}-day reserve.',
  'home.needSub': 'Reorder soon to stay above your {buffer}-day reserve.',
  'home.cardAllSupplies': 'All supplies',
  'home.cardTrackedOne': '{count} tracked',
  'home.cardTrackedOther': '{count} tracked',
  'home.cardReorder': 'Reorder',
  'home.cardToReorderOne': '{count} to reorder',
  'home.cardToReorderOther': '{count} to reorder',
  'home.nothingNeeded': 'Nothing needed',
  'home.addSupply': 'Add a supply',

  // ── supply status row (home + reorder) ──
  'row.outOfStock': 'Out of stock',
  'row.reorderSoon': 'Reorder soon',
  'row.wellStocked': 'Well stocked',
  'row.noneOnHand': 'None on hand',
  'row.daysLeftOne': '{count} day left',
  'row.daysLeftOther': '{count} days left',
  'row.reorder': 'Reorder',

  // ── reorder page ──
  'reorder.kicker': 'Reorder',
  'reorder.title': 'What to reorder',
  'reorder.intro':
    "Only the supplies that would dip below your {buffer}-day reserve. Each button opens the supplier's reorder page — we never place an order for you.",
  'reorder.nothingTitle': 'Nothing to reorder',
  'reorder.nothingBody':
    'Everything you track is comfortably above your reserve. Check back when something runs low.',
  'reorder.viewAll': 'View all supplies',
  'reorder.distributorsTitle': 'Distributor shortcuts',
  'reorder.distributorsBody': 'Place or check on an order with a major DME supplier.',

  // ── shared toasts ──
  'toast.openingSupplier': "Opening {label}'s reorder page in a new tab.",
  'toast.openingSearch': 'Opening a supplier search in a new tab.',

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
    "Flag a supply as “reorder soon” while you still have this many days of reserve left — so you're never racing to zero.",
  'settings.daysReserve': 'days of reserve',
  'settings.daysUnit': 'days',
  'settings.pushTitle': 'Push notifications',
  'settings.pushBody':
    'The most useful alerts reach you when the app is closed (“Refill-eligible Thursday — tap to reorder”).',
  'settings.suppliersTitle': 'Supplier shortcuts',
  'settings.suppliersBody': 'Jump to a distributor to place or check on an order.',
} as const

export type TKey = keyof typeof en

export const fr: Record<TKey, string> = {
  // ── common ──
  'common.loading': 'Chargement…',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.back': 'Retour',
  'common.email': 'E-mail',
  'common.reload': "C'est fait — actualiser",

  // ── nav ──
  'nav.home': 'Accueil',
  'nav.supplies': 'Fournitures',
  'nav.add': 'Ajouter',
  'nav.reorder': 'Recommander',
  'nav.peopleICareFor': 'Personnes dont je prends soin',
  'nav.sharing': 'Partage',
  'nav.rotateSites': 'Rotation des sites',
  'nav.calendar': 'Calendrier',
  'nav.devices': 'Appareils',
  'nav.prescriptions': 'Ordonnances',
  'nav.appointments': 'Rendez-vous',
  'nav.costs': 'Coûts',
  'nav.medicalId': 'Fiche médicale',
  'nav.settings': 'Paramètres',
  'nav.signOut': 'Se déconnecter',
  'nav.more': 'Plus',

  // ── landing ──
  'landing.signIn': 'Se connecter',
  'landing.badge': 'Un soutien quotidien pour le diabète de type 1',
  'landing.heroTitle': 'Ne manquez plus jamais de fournitures pour le diabète.',
  'landing.heroSub':
    "T1D Hub suit vos pods, capteurs, réservoirs et votre insuline, et vous indique quand recommander, avant que vous ne soyez à court. Conçu pour les familles qui vivent avec le diabète de type 1.",
  'landing.getStarted': 'Commencer',
  'landing.twoWays': 'Deux façons d’utiliser T1D Hub',
  'landing.patientTitle': 'Je gère mes propres fournitures',
  'landing.patientBody':
    "Suivez vos pods, capteurs, réservoirs et votre insuline, et sachez exactement quand recommander — avant d’être à court.",
  'landing.caregiverTitle': 'J’accompagne une personne diabétique',
  'landing.caregiverBody':
    "Gardez un œil serein sur les fournitures d’un proche et aidez-le à recommander avant qu’il ne soit à court — avec l’accès qu’il choisit de vous accorder.",
  'landing.whatYouGet': 'Ce que vous obtenez',
  'landing.feat1Title': 'Le bon moment pour recommander',
  'landing.feat1Body':
    "Sachez exactement quand recommander chaque fourniture — calculé selon votre marge de sécurité et votre fenêtre de renouvellement d’assurance, pas seulement une fois à zéro.",
  'landing.feat2Title': 'Suivi de la rotation des sites',
  'landing.feat2Body':
    "Notez vos sites de perfusion et d’injection sur une carte du corps pour bien alterner et laisser chaque zone se reposer.",
  'landing.feat3Title': 'Partage avec les proches',
  'landing.feat3Body':
    "Invitez un parent ou un partenaire à consulter — et, si vous le souhaitez, à aider à gérer — les fournitures, pour que personne ne se retrouve à court sans le savoir.",
  'landing.feat4Title': 'Fiche médicale d’urgence',
  'landing.feat4Body':
    "Une fiche facultative, en lecture seule, qu’un secouriste peut consulter sur un téléphone verrouillé, sans connexion.",
  'landing.reassureTitle': 'Des chiffres honnêtes, jamais d’approximations',
  'landing.reassureBody':
    "Chaque quantité et chaque date provient des données que vous saisissez ou scannez. Quand une information est inconnue, l’application le dit — elle n’invente jamais un niveau de stock ou une date de péremption.",
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
  'login.magicIntro': 'Nous vous enverrons un lien de connexion à usage unique — aucun mot de passe requis.',
  'login.sendMagic': 'Envoyer le lien magique',
  'login.forgotIntro':
    'Saisissez votre e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.',
  'login.sendReset': 'Envoyer le lien de réinitialisation',
  'login.backToSignIn': 'Retour à la connexion',
  'login.footerEncrypted': 'Chiffré pendant le transfert',
  'login.footerYours': 'Vos données restent les vôtres',
  'login.showPassword': 'Afficher le mot de passe',
  'login.hidePassword': 'Masquer le mot de passe',
  'login.errMismatch': 'Les mots de passe ne correspondent pas.',
  'login.errMin8': 'Le mot de passe doit comporter au moins 8 caractères.',
  'login.createdConfirm':
    'Compte créé ! Consultez votre boîte de réception et cliquez sur le lien de confirmation pour terminer la connexion.',
  'login.magicSent': 'Lien magique envoyé ! Consultez votre boîte de réception.',
  'login.resetSent':
    'Lien de réinitialisation envoyé ! Consultez votre boîte de réception — le lien expire dans 1 heure.',

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
    "Ajoutez votre première fourniture — un capteur, un pod, un réservoir ou un flacon — et nous suivrons sa durée et vous indiquerons quand recommander.",
  'home.addFirst': 'Ajouter ma première fourniture',
  'home.allSet': 'Tout est en ordre',
  'home.needAttentionOne': '{count} fourniture nécessite votre attention',
  'home.needAttentionOther': '{count} fournitures nécessitent votre attention',
  'home.allSetSubOne': 'Votre fourniture est au-dessus de votre réserve de {buffer} jours.',
  'home.allSetSubOther': 'Vos {count} fournitures sont au-dessus de votre réserve de {buffer} jours.',
  'home.needSub': 'Recommandez bientôt pour rester au-dessus de votre réserve de {buffer} jours.',
  'home.cardAllSupplies': 'Toutes les fournitures',
  'home.cardTrackedOne': '{count} suivie',
  'home.cardTrackedOther': '{count} suivies',
  'home.cardReorder': 'Recommander',
  'home.cardToReorderOne': '{count} à recommander',
  'home.cardToReorderOther': '{count} à recommander',
  'home.nothingNeeded': 'Rien à faire',
  'home.addSupply': 'Ajouter une fourniture',

  // ── supply status row ──
  'row.outOfStock': 'En rupture',
  'row.reorderSoon': 'À recommander bientôt',
  'row.wellStocked': 'Bien approvisionné',
  'row.noneOnHand': 'Aucune en stock',
  'row.daysLeftOne': '{count} jour restant',
  'row.daysLeftOther': '{count} jours restants',
  'row.reorder': 'Recommander',

  // ── reorder page ──
  'reorder.kicker': 'Recommander',
  'reorder.title': 'À recommander',
  'reorder.intro':
    "Seules les fournitures qui passeraient sous votre réserve de {buffer} jours. Chaque bouton ouvre la page de commande du fournisseur — nous ne passons jamais de commande à votre place.",
  'reorder.nothingTitle': 'Rien à recommander',
  'reorder.nothingBody':
    'Tout ce que vous suivez est confortablement au-dessus de votre réserve. Revenez quand quelque chose vient à manquer.',
  'reorder.viewAll': 'Voir toutes les fournitures',
  'reorder.distributorsTitle': 'Raccourcis distributeurs',
  'reorder.distributorsBody':
    "Passez ou suivez une commande auprès d’un grand distributeur de matériel médical.",

  // ── shared toasts ──
  'toast.openingSupplier': 'Ouverture de la page de commande de {label} dans un nouvel onglet.',
  'toast.openingSearch': "Ouverture d’une recherche de fournisseur dans un nouvel onglet.",

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
    "Signalez une fourniture comme « à recommander bientôt » tant qu’il vous reste ce nombre de jours de réserve — pour ne jamais courir jusqu’à zéro.",
  'settings.daysReserve': 'jours de réserve',
  'settings.daysUnit': 'jours',
  'settings.pushTitle': 'Notifications push',
  'settings.pushBody':
    "Les alertes les plus utiles vous parviennent même lorsque l’application est fermée (« Renouvellement possible jeudi — appuyez pour recommander »).",
  'settings.suppliersTitle': 'Raccourcis fournisseurs',
  'settings.suppliersBody': 'Accédez à un distributeur pour passer ou suivre une commande.',
}
