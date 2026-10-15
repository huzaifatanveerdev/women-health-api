/**
 * Localization utility for multi-language API responses
 * Supports English (en) and German (de) languages
 */

// Message mappings for different languages
const MESSAGES = {
  en: {
    // Success messages
    'user.created': 'User created successfully',
    'user.updated': 'User profile updated successfully',
    'user.settings.updated': 'User settings updated successfully',
    'user.profile.picture.uploaded': 'Profile picture uploaded successfully',
    'user.profile.picture.deleted': 'Profile picture deleted successfully',
    'user.login.successful': 'Login successful',
    'user.logout.successful': 'Logout successful',
    'user.password.reset': 'Password reset successful',
    'user.otp.sent': 'OTP sent successfully',
    'user.otp.verified': 'OTP verified successfully',
    'user.registered': 'User registered successfully',
    'account.deleted': 'Account deleted successfully',
    
    // Daily symptoms
    'symptoms.submitted': 'Daily symptoms submitted successfully',
    'symptoms.updated': 'Daily symptoms updated successfully',
    'symptoms.removed': 'Daily symptoms removed successfully',
    'symptoms.not.found': 'No symptoms found for today',
    
    // Menstrual cycle
    'cycle.calculated': 'Menstrual cycle calculated successfully',
    'cycle.updated': 'Cycle updated successfully',
    'cycle.not.found': 'No cycle data found',
    'cycle.period.start.set': 'Period start date updated successfully',
    'cycle.period.end.set': 'Period end date updated successfully',
    'cycle.id.required': 'Cycle ID is required',
    'cycle.start.or.end.required': 'A start date or an end date is required.',
    'cycle.start.or.end.not.both': 'Please provide either a start date or an end date, not both.',
    'cycle.deleted.count': 'Deleted {count} menstrual cycle records for testing',
    'cycle.summary.in.progress': 'Your cycle is in progress. We will have more information as you keep using the app.',
    'cycle.analysis.all.in.range': 'Your last {n} completed cycles are within the typical range (21\u201135\u00A0days).',
    'cycle.analysis.some.out.of.range': '{x} out of your last {n} completed cycles are outside a normal range of 21\u201135\u00A0days.',
    
    // Menstrual flow
    'flow.required': 'Flow is required',
    'flow.invalid': 'Flow must be one of: Light, Medium, Heavy',
    'flow.recorded': 'Menstrual flow recorded successfully',
    'flow.not.found': 'No menstrual flow records found',
    
    // Email content - Registration OTP
    'email.registration.subject': 'Email Verification Code – women-help-api',
    'email.registration.title': 'Verify your email',
    'email.registration.greeting': 'Thank you for registering with women-help-api. Please use the following OTP to verify your email address:',
    'email.registration.validity': 'This code is valid for {duration}',
    'email.registration.ignore': 'If you didn\'t request this verification, please ignore this email.',
    
    // Email content - Password Reset OTP
    'email.reset.subject': 'Password Reset Code – women-help-api',
    'email.reset.title': 'Reset your password',
    'email.reset.greeting': 'You requested to reset your password for women-help-api. Please use the following code to continue:',
    'email.reset.validity': 'This code is valid for {duration}.',
    'email.reset.ignore': 'If you did not request a password reset, you can safely ignore this email.',
    
    // Email content - Welcome email after registration
    'email.welcome.subject': 'Welcome to women-help-api — You’re part of something meaningful ❤',
    'email.welcome.greeting': 'Hi {name},',
    'email.welcome.greeting.noName': 'Hi there,',
    'email.welcome.paragraph1': 'Welcome to women-help-api. I\'m really glad you\'re here.',
    'email.welcome.paragraph2': 'By joining, you\'re not just tracking your cycle. You\'re supporting women who face period poverty every single month.',
    'email.welcome.paragraph3': 'Inside the app, you\'ll find clarity about your body and the knowledge that your choices create real impact beyond yourself.',
    'email.welcome.paragraph4': 'I\'m grateful you\'re here.',
    'email.welcome.paragraph5': 'Together, this adds up to real change.',
    'email.welcome.signature': 'Warm regards,\nwomen-help-api\nFounder of women-help-api',
    
    // Email content - Subscription purchase confirmation
    'email.subscription.subject': 'You\'re enabling menstrual care access ❤',
    'email.subscription.greeting': 'Hi {name},',
    'email.subscription.paragraph1': 'Thank you from the bottom of my heart for choosing a women-help-api Impact Plan.',
    'email.subscription.paragraph2': 'Your subscription is more than features. It enables access to menstrual care.',
    'email.subscription.paragraph3': 'Because of you, we can keep menstrual health knowledge free and accessible for women everywhere.',
    'email.subscription.paragraph4': 'Your support also provides real access to menstrual products for women and girls who otherwise couldn’t afford them.',
    'email.subscription.paragraph5': 'You are now part of a circle of women who support and uplift each other.',
    'email.subscription.paragraph6': 'Thank you for believing in this mission and for being part of it.',
    'email.subscription.signature': 'With gratitude,\nwomen-help-api\nFounder of women-help-api',
    'email.subscription.impact.impact': 'Your contribution enables a woman to access menstrual care for 1 month.',
    'email.subscription.impact.plus': 'Your contribution enables a woman to access menstrual care for 5 months – so she can focus on her life, not her period.',
    'email.subscription.impact.max': 'Your contribution enables a woman to access menstrual care for 12 months – so she can study, work, and shape her own future.',
    'email.subscription.impact.impactLegacyYearly': 'Your contribution enables a woman to access menstrual care for 3 months.',

    // Email content - Subscription cancellation
    'email.cancellation.subject': 'Your women-help-api membership has ended',
    'email.cancellation.greeting': 'Hi {name},',
    'email.cancellation.confirm': 'This confirms that your women-help-api Impact Plan has been canceled.',
    'email.cancellation.accessUntil': 'Your premium access will remain active until {date}.',
    'email.cancellation.thanks': 'Thank you for being part of women-help-api.',
    'email.cancellation.impactIntro': 'During your time with us, you helped provide {impactDuration} of menstrual care. That impact is real. And it remains.',
    'email.cancellation.paragraph2': 'Because of your support, we were able to keep menstrual health knowledge free and provide tangible help to women and girls facing period poverty.',
    'email.cancellation.return': 'If you ever choose to return, your place in the circle remains open.',
    'email.cancellation.feedback': 'If you would like to share feedback, we would truly appreciate it:\nhello@women-help-api.com',
    'email.cancellation.wishing': 'Wishing you all the best.',
    'email.cancellation.signature': 'Warm regards,\nwomen-help-api\nFounder of women-help-api',
    'email.cancellation.impact.impact': 'one month',
    'email.cancellation.impact.plus': 'five months',
    'email.cancellation.impact.max': 'one full year',
    'email.cancellation.impact.impactLegacyYearly': 'three months',

    // Email footer
    'email.footer.automated': 'This is an automated email. Please do not reply to this message.',
    
    // Error messages
    'error.email.required': 'Email is required',
    'error.password.required': 'Password is required',
    'error.otp.required': 'OTP is required',
    'error.email.otp.required': 'Email and OTP are required',
    'error.email.password.token.required': 'Email, new Password, and temporary Token are required',
    'error.symptoms.array.required': 'Symptoms array is required and must be an array',
    'error.symptoms.array.invalid': 'Symptoms are required',
    'error.name.required': 'Name is required',
    'error.phone.required': 'Phone number is required',
    'error.gender.required': 'Gender is required',
    'error.dob.required': 'Date of birth is required',
    'error.password.too.short': 'Password must be at least 6 characters long',
    'error.password.too.long': 'Password must be less than 128 characters long',
    'error.email.invalid': 'Please provide a valid email address',
    'error.email.already.exists': 'User with this email already exists',
    'error.user.not.found': 'User not found',
    'error.account.already.deleted': 'Account has already been deleted',
    'error.invalid.credentials': 'Invalid credentials',
    'error.access.denied': 'Access denied',
    'error.access.denied.profile': 'Access denied: You can only update your own profile.',
    'error.access.denied.picture': 'Access denied: You can only update your own profile picture.',
    'error.access.denied.delete.picture': 'Access denied: You can only delete your own profile picture.',
    'error.invalid.or.expired.token': 'Invalid or expired token',
    'error.server.error': 'Server error',
    'error.database.error': 'Database operation failed',
    'error.validation.error': 'Validation error',
    'error.invalid.id.format': 'Invalid ID format',
    'error.duplicate.field': 'Duplicate field value entered',
    'error.route.not.found': 'Route not found',
    'error.internal.server.error': 'Internal server error',
    
    // Validation messages
    'validation.email.required': 'Email is required',
    'validation.password.required': 'Password is required',
    'validation.name.required': 'Name is required',
    'validation.phone.required': 'Phone number is required',
    'validation.gender.required': 'Gender is required',
    'validation.dob.required': 'Date of birth is required',
    'validation.symptoms.required': 'Symptoms array is required',
    'validation.period.start.required': 'Period start date is required',
    'validation.cycle.length.required': 'Cycle length is required',
    'validation.period.duration.required': 'Period duration is required',
    
    // OTP messages
    'otp.sent': 'OTP sent successfully',
    'otp.verified': 'OTP verified successfully',
    'otp.not.found': 'No OTP found for this email',
    'otp.expired': 'Das OTP ist abgelaufen',
    'otp.already.used': 'OTP has already been used',
    'otp.max.attempts': 'Maximum OTP attempts exceeded',
    'otp.invalid': 'Invalid OTP',
    'otp.failed.to.send': 'Failed to send OTP',
    'otp.verification.failed': 'OTP verification failed',
    'otp.if.email.exists': 'If the email exists, an OTP has been sent',
    
    // Token messages
    'token.required': 'Temporary token is required for registration',
    'token.email.mismatch': 'Email verification token does not match registration email',
    
    // Registration/Login messages
    'registration.missing.fields': 'Missing required fields',
    'registration.field.required': '{field} is required',
    'registration.password.mismatch': 'Password and confirm password do not match',
    'login.email.password.required': 'Email and password are required',
    'login.invalid.credentials': 'Invalid email or password',
    'login.failed': 'Login failed',
    'auth.sso.missing.fields': 'Provider and idToken are required',
    'auth.sso.invalid.provider': 'Invalid SSO provider. Use google or apple',
    'auth.sso.invalid.token': 'Invalid or expired sign-in token',
    'auth.sso.not.configured': 'SSO is not configured on the server',
    'auth.sso.email.required': 'Email is required on first sign-in with Apple',
    'auth.sso.email.account.exists': 'This email is registered with a password. Please sign in with email and password',
    'auth.sso.provider.account.exists': 'This email is registered with a different sign-in method',
    'auth.sso.user.not.found': 'No account found. Please sign up first',
    'auth.sso.account.exists.try.login': 'An account with this email already exists. Please log in',
    'auth.login.use.sso': 'Please sign in with Google or Apple',
    'auth.login.no.password': 'Password sign-in is not available for this account',
    'auth.reset.password.sso.only': 'Password reset is only available for email accounts',
    'auth.forgot.password.use.google': 'This account uses Google sign-in. Password reset is not available. Please go back and sign in with Google instead.',
    'auth.forgot.password.use.apple': 'This account uses Apple sign-in. Password reset is not available. Please go back and sign in with Apple instead.',
    'personalization.incomplete': 'Please complete all required profile fields',
    'personalization.completed': 'Profile completed successfully',
    
    // Validation messages (additional)
    'validation.invalid.symptom': 'Invalid symptom: {symptom}. Allowed symptoms are: {allowed}',
    'validation.invalid.date.format': 'Invalid date format. Use YYYY-MM-DD',
    'validation.cannot.modify.past': 'Cannot modify symptoms from previous days',
    'validation.no.symptom.entry': 'No symptom entry found for today. Please submit symptoms first.',
    'validation.symptom.entry.exists': 'Daily symptom entry already exists for this date',
    'validation.symptom.entry.not.found': 'Daily symptom entry not found',
    'validation.insights.invalid.filter': 'Invalid filter. Use today, 7d, 30d, or custom',
    'validation.insights.dates.required': 'startDate and endDate are required when filter is custom',
    'validation.insights.end.before.start': 'endDate must be on or after startDate',
    'validation.insights.range.too.long': 'Custom date range cannot exceed 365 days',
    'validation.insights.invalid.groupBy': 'Invalid groupBy. Use symptom or day',
    'validation.insights.invalid.view': 'Invalid view. Use phases, cycleList, or cycleDetail',
    'validation.insights.cycle.not.found': 'Cycle not found',
    'validation.insights.cycle.not.in.range': 'Cycle is outside the selected date range',
    'validation.insights.filter.not.allowed.for.phases': 'Date filter is not used for phase insights',
    'validation.flowInsights.invalid.view': 'Invalid view. Use overview, cycleList, or cycleDetail',
    'flowInsights.access.denied': 'Subscribe to unlock menstrual flow insights',
    
    // Operation failed messages
    'failed.create.user': 'Failed to create user',
    'failed.retrieve.user': 'Failed to retrieve user',
    'failed.update.user': 'Failed to update user',
    'failed.update.profile': 'Failed to update user profile',
    'failed.update.picture': 'Failed to update profile picture',
    'failed.delete.picture': 'Failed to delete profile picture',
    'failed.delete.account': 'Failed to delete account',
    'failed.reset.password': 'Failed to reset password',
    'failed.submit.symptoms': 'Failed to submit daily symptoms',
    'failed.update.symptoms': 'Failed to update daily symptoms',
    'failed.retrieve.symptoms': 'Failed to retrieve daily symptoms',
    'failed.retrieve.symptom.history': 'Failed to retrieve symptom history',
    'failed.retrieve.symptom.date': 'Failed to retrieve symptoms for the specified date',
    'failed.delete.symptom': 'Failed to delete daily symptom entry',
    'failed.retrieve.symptom.insights': 'Failed to retrieve symptom insights',
    'failed.retrieve.symptom.insights.byCycle': 'Failed to retrieve symptom insights',
    'failed.retrieve.symptom.insights.patterns': 'Failed to retrieve symptom patterns',
    'failed.retrieve.flow.insights': 'Failed to retrieve menstrual flow insights',

    // Symptom insights patterns
    'symptomInsights.patterns.emptySummary': "We're still learning your cycle. Keep tracking to discover your personal symptom patterns.",
    'symptomInsights.patterns.cyclesSummary': '{x} of your last {n} tracked cycles',
    'symptomInsights.patterns.phaseCount': '{count} times in the {phase} phase',
    'symptomInsights.patterns.phaseCountSingular': '1 time in the {phase} phase',
    'symptomInsights.patterns.phaseName.menstrual': 'menstrual',
    'symptomInsights.patterns.phaseName.follicular': 'follicular',
    'symptomInsights.patterns.phaseName.ovulatory': 'ovulatory',
    'symptomInsights.patterns.phaseName.luteal': 'luteal',
    
    // Feature and voting messages
    'feature.id.required': 'Feature ID is required',
    'feature.id.invalid': 'Invalid feature ID',
    'feature.already.voted': 'You have already voted on this feature',
    'feature.vote.submitted': 'Vote submitted successfully',
    'idea.required': 'Idea is required',
    'idea.too.long': 'Idea cannot exceed 1000 characters',
    'idea.submitted': 'Idea submitted successfully',
    
    // System messages
    'welcome.message': 'Welcome to women-help-api Backend API',
    'no.period.date': 'No period start date available. Please set your last period start date first.',
    'cycle.ended': 'Cycle has ended',
    'cycle.ongoing': 'Cycle is ongoing',
    
    // Subscription plan messages
    'subscription.plans.retrieved': 'Subscription plans retrieved successfully',
    'subscription.plan.created': 'Subscription plan created successfully',
    'subscription.plan.set.success': 'Subscription plan set successfully',
    'subscription.plan.retrieved': 'Subscription plan retrieved successfully',
    'subscription.plan.renewed': 'Subscription plan renewed successfully',
    'subscription.plan.name.required': 'Name is required',
    'subscription.plan.tag.required': 'Tag is required',
    'subscription.plan.amount.required': 'Amount is required',
    'subscription.plan.impact.required': 'Impact is required',
    'subscription.plan.description.required': 'Description is required',
    'subscription.plan.currencyName.required': 'Currency name is required',
    'subscription.plan.currencySymbol.required': 'Currency symbol is required',
    'subscription.plan.duration.required': 'Duration is required',
    'subscription.plan.id.required': 'Subscription plan ID is required',
    'subscription.plan.not.found': 'Subscription plan not found',
    'failed.get.subscription.plans': 'Failed to get subscription plans',
    'failed.create.subscription.plan': 'Failed to create subscription plan',
    'failed.set.subscription.plan': 'Failed to set subscription plan',
    'failed.get.subscription.plan': 'Failed to get subscription plan',
    'failed.renew.subscription.plan': 'Failed to renew subscription plan',
    
    // Stripe subscription messages
    'subscription.canceled.immediately': 'Subscription canceled immediately',
    'subscription.canceled.at.period.end': 'Subscription will be canceled at the end of the current billing period',
    'subscription.status.fetch.failed': 'Failed to fetch subscription status',

    // Impact messages
    'impact.targetCount.set.success': 'Target count set successfully',
    'impact.collective.progress.retrieved': 'Collective progress retrieved successfully',
    'impact.user.retrieved': 'User impact retrieved successfully',
    'impact.targetCount.required': 'Target count is required',
    'impact.targetCount.invalid': 'Target count must be a valid number',
    'impact.targetCount.positive': 'Target count must be a positive number',
    'failed.set.target.count': 'Failed to set target count',
    'failed.get.collective.progress': 'Failed to get collective progress',
    'failed.get.user.impact': 'Failed to get user impact',

    // Per-plan "yourImpact" copy returned by GET /api/impact/user-impact
    'impact.yourImpact.impact': 'You\u2019ve enabled 1 month of access to menstrual products',
    'impact.yourImpact.plus': 'You\u2019ve enabled 5 months of access to menstrual products',
    'impact.yourImpact.max': 'You\u2019ve enabled 12 months of access to menstrual products',
    'impact.yourImpact.impactLegacyYearly': 'You\u2019ve enabled 3 months of access to menstrual products',
    
    // women-help-api support messages
    'women-help-api.support.added.success': 'Added to women-help-api support waiting list successfully',
    'women-help-api.support.check.success': 'women-help-api support list status retrieved successfully',
    'women-help-api.support.location.required': 'Location is required',
    'women-help-api.support.already.added': 'You are already added to the waiting list',
    'failed.add.women-help-api.support': 'Failed to add to women-help-api support list',
    'failed.check.women-help-api.support': 'Failed to check women-help-api support list status',
    
    // Invite link messages
    'invite.links.stored.success': 'Invite links stored successfully',
    'invite.link.retrieved.success': 'Invite link retrieved successfully',
    'invite.unavailable': 'Invite unavailable, please try again later.',
    'invite.data.required': 'Invite data is required',
    'invite.key.invalid': 'Invalid invite key. Must be one of: android, ios, dynamic',
    'failed.store.invite.links': 'Failed to store invite links',
    'failed.get.invite.link': 'Failed to get invite link'
  },
  
  de: {
    // Success messages
    'user.created': 'Benutzerkonto erfolgreich erstellt',
    'user.updated': 'Benutzerprofil erfolgreich aktualisiert',
    'user.settings.updated': 'Einstellungen erfolgreich aktualisiert',
    'user.profile.picture.uploaded': 'Profilbild erfolgreich hochgeladen',
    'user.profile.picture.deleted': 'Profilbild erfolgreich gelöscht',
    'user.login.successful': 'Anmeldung erfolgreich',
    'user.logout.successful': 'Abmeldung erfolgreich',
    'user.password.reset': 'Passwort erfolgreich zurückgesetzt',
    'user.otp.sent': 'OTP- Code erfolgreich gesendet',
    'user.otp.verified': 'OTP erfolgreich verifiziert',
    'user.registered': 'Benutzerkonto erfolgreich registriert',
    'account.deleted': 'Konto erfolgreich gelöscht',
    
    // Daily symptoms
    'symptoms.submitted': 'Tägliche Symptome erfolgreich übermittelt',
    'symptoms.updated': 'Tägliche Symptome erfolgreich aktualisiert',
    'symptoms.removed': 'Tägliche Symptome erfolgreich entfernt',
    'symptoms.not.found': 'Für heute wurden keine Symptome gefunden',
    
    // Menstrual cycle
    'cycle.calculated': 'Menstruationszyklus erfolgreich berechnet',
    'cycle.updated': 'Zyklus erfolgreich aktualisiert',
    'cycle.not.found': 'Keine Zyklusdaten gefunden',
    'cycle.period.start.set': 'Periodenstartdatum erfolgreich aktualisiert',
    'cycle.period.end.set': 'Periodenenddatum erfolgreich aktualisiert',
    'cycle.id.required': 'Zyklus-ID ist erforderlich',
    'cycle.start.or.end.required': 'Ein Startdatum oder ein Enddatum ist erforderlich.',
    'cycle.start.or.end.not.both': 'Bitte gib entweder das Startdatum oder das Enddatum an, nicht beides.',
    'cycle.deleted.count': '{count} Menstruationszyklus-Datensätze zum Testen gelöscht',
    'cycle.summary.in.progress': 'Dein Zyklus ist noch im Gange. Je länger du die App nutzt, desto mehr Informationen können wir dir geben.',
    'cycle.analysis.all.in.range': 'Deine letzten {n} abgeschlossenen Zyklen liegen im typischen Bereich (21\u201135\u00A0Tage).',
    'cycle.analysis.some.out.of.range': '{x} von deinen letzten {n} abgeschlossenen Zyklen liegen außerhalb des normalen Bereichs von 21\u201135\u00A0Tagen.',
    
    // Menstrual flow
    'flow.required': 'Menstruationsfluss ist erforderlich',
    'flow.invalid': 'Bitte wähle einen Menstruationsfluss: leicht, mittel oder stark',
    'flow.recorded': 'Menstruationsfluss erfolgreich gespeichert',
    'flow.not.found': 'Es wurden keine Menstruationsfluss-Einträge gefunden',
    
    // Email content - Registration OTP
    'email.registration.subject': 'E-Mail-Bestätigungscode – women-help-api',
    'email.registration.title': 'E-Mail-Adresse bestätigen',
    'email.registration.greeting': 'Vielen Dank für deine Registrierung bei women-help-api. Bitte verwende den folgenden Code, um deine E-Mail-Adresse zu bestätigen:',
    'email.registration.validity': 'Dieser Code ist {duration} gültig',
    'email.registration.ignore': 'Falls du diese Registrierung nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    
    // Email content - Password Reset OTP
    'email.reset.subject': 'Passwort-Zurücksetzen – women-help-api',
    'email.reset.title': 'Passwort zurücksetzen',
    'email.reset.greeting': 'Du hast das Zurücksetzen deines Passworts für women-help-api angefordert. Bitte verwende den folgenden Code, um fortzufahren:',
    'email.reset.validity': 'Dieser Code ist {duration} gültig.',
    'email.reset.ignore': 'Wenn du kein Zurücksetzen deines Passworts angefordert hast, kannst du diese E-Mail einfach ignorieren.',
    
    // Email content - Welcome email after registration
    'email.welcome.subject': 'Willkommen bei women-help-api — du bist Teil von etwas Bedeutungsvollem ❤',
    'email.welcome.greeting': 'Hi {name},',
    'email.welcome.greeting.noName': 'Hallo,',
    'email.welcome.paragraph1': 'Willkommen bei women-help-api. Ich freue mich sehr, dass du hier bist.',
    'email.welcome.paragraph2': 'Mit deiner Anmeldung bei women-help-api verfolgst du nicht nur deinen Zyklus. Du unterstützt Frauen, die jeden Monat von Periodenarmut betroffen sind.',
    'email.welcome.paragraph3': 'In der App findest du Klarheit über deinen Körper und die Gewissheit, dass deine Entscheidungen über dich selbst hinaus Wirkung entfalten.',
    'email.welcome.paragraph4': 'Ich bin dankbar, dass du hier bist.',
    'email.welcome.paragraph5': 'Gemeinsam entsteht daraus echte Wirkung.',
    'email.welcome.signature': 'Liebe Grüße,\nwomen-help-api\nGründerin von women-help-api',
    
    // Email content - Subscription purchase confirmation
    'email.subscription.subject': 'Du ermöglichst Zugang zu Menstruationsversorgung ❤',
    'email.subscription.greeting': 'Hi {name},',
    'email.subscription.paragraph1': 'Danke von Herzen, dass du dich für einen women-help-api Impact Plan entschieden hast.',
    'email.subscription.paragraph2': 'Dein Abo ist mehr als Funktionen. Es ermöglicht Zugang zu Menstruationsversorgung.',
    'email.subscription.paragraph3': 'Dank dir können wir Wissen rund um Menstruationsgesundheit für Frauen weltweit frei zugänglich halten.',
    'email.subscription.paragraph4': 'Dein Beitrag ermöglicht Frauen und Mädchen Zugang zu Periodenprodukten, die sie sich sonst nicht leisten könnten.',
    'email.subscription.paragraph5': 'Du bist jetzt Teil eines Kreises von Frauen, die sich gegenseitig stärken.',
    'email.subscription.paragraph6': 'Danke, dass du an diese Mission glaubst und Teil davon bist.',
    'email.subscription.signature': 'Von Herzen,\nwomen-help-api\nGründerin von women-help-api',
    'email.subscription.impact.impact': 'Dein Beitrag ermöglicht einer Frau 1 Monat Zugang zu Menstruationsversorgung.',
    'email.subscription.impact.plus': 'Dein Beitrag ermöglicht einer Frau 5 Monate Zugang zu Menstruationsversorgung – damit sie sich auf ihr Leben konzentrieren kann, nicht auf ihre Periode.',
    'email.subscription.impact.max': 'Dein Beitrag ermöglicht einer Frau 12 Monate Zugang zu Menstruationsversorgung – damit sie lernen, arbeiten und ihre eigene Zukunft gestalten kann.',
    'email.subscription.impact.impactLegacyYearly': 'Dein Beitrag ermöglicht einer Frau 3 Monate Zugang zu Menstruationsversorgung.',

    // Email content - Subscription cancellation
    'email.cancellation.subject': 'Deine women-help-api Mitgliedschaft wurde beendet',
    'email.cancellation.greeting': 'Hi {name},',
    'email.cancellation.confirm': 'hiermit bestätigen wir dir, dass dein women-help-api Impact Plan beendet wurde.',
    'email.cancellation.accessUntil': 'Dein Zugang zu den Premium-Funktionen bleibt noch bis zum {date} aktiv.',
    'email.cancellation.thanks': 'Danke, dass du Teil von women-help-api warst.',
    'email.cancellation.impactIntro': 'In deiner Zeit bei uns hast du geholfen, {impactDuration} Menstruationsversorgung zu ermöglichen. Das ist echte Wirkung. Und sie bleibt.',
    'email.cancellation.paragraph2': 'Durch deine Unterstützung konnten wir Wissen frei zugänglich halten und Frauen sowie Mädchen konkret helfen, die von Periodenarmut betroffen sind.',
    'email.cancellation.return': 'Falls du dich irgendwann entscheidest zurückzukommen, bist du jederzeit willkommen. Dein Platz im Kreis bleibt offen.',
    'email.cancellation.feedback': 'Wenn du uns Feedback geben möchtest, freuen wir uns sehr:\nhello@women-help-api.com',
    'email.cancellation.wishing': 'Alles Gute für dich.',
    'email.cancellation.signature': 'Herzliche Grüße\nwomen-help-api\nGründerin von women-help-api',
    'email.cancellation.impact.impact': 'einen Monat',
    'email.cancellation.impact.plus': 'fünf Monate',
    'email.cancellation.impact.max': 'ein ganzes Jahr',
    'email.cancellation.impact.impactLegacyYearly': 'drei Monate',

    // Email footer
    'email.footer.automated': 'Dies ist eine automatisierte E-Mail. Bitte antworte nicht auf diese Nachricht.',
    
    // Error messages
    'error.email.required': 'E-Mail-Adresse ist erforderlich',
    'error.password.required': 'Passwort ist erforderlich',
    'error.otp.required': 'OTP ist erforderlich',
    'error.email.otp.required': 'E-Mail-Adresse und OTP sind erforderlich',
    'error.email.password.token.required': 'E-Mail-Adresse, neues Passwort und temporärer Token sind erforderlich.',
    'error.symptoms.array.required': 'Symptom-Array ist erforderlich und muss ein Array sein',
    'error.symptoms.array.invalid': 'Symptome sind erforderlich',
    'error.name.required': 'Name ist erforderlich',
    'error.phone.required': 'Telefonnummer ist erforderlich',
    'error.gender.required': 'Geschlecht ist erforderlich',
    'error.dob.required': 'Geburtsdatum ist erforderlich',
    'error.password.too.short': 'Passwort muss mindestens 6 Zeichen lang sein',
    'error.password.too.long': 'Passwort muss weniger als 128 Zeichen lang sein',
    'error.email.invalid': 'Bitte gib eine gültige E-Mail-Adresse ein',
    'error.email.already.exists': 'Mit dieser E-Mail-Adresse existiert bereits ein Konto',
    'error.user.not.found': 'Benutzer nicht gefunden',
    'error.account.already.deleted': 'Das Konto wurde bereits gelöscht',
    'error.invalid.credentials': 'Ungültige Anmeldedaten',
    'error.access.denied': 'Zugriff verweigert',
    'error.access.denied.profile': 'Zugriff verweigert: Du kannst nur dein eigenes Profil aktualisieren.',
    'error.access.denied.picture': 'Zugriff verweigert: Du kannst nur dein eigenes Profilbild aktualisieren.',
    'error.access.denied.delete.picture': 'Zugriff verweigert: Du kannst nur dein eigenes Profilbild löschen.',
    'error.invalid.or.expired.token': 'Ungültiger oder abgelaufener Token',
    'error.server.error': 'Serverfehler',
    'error.database.error': 'Der Datenbankvorgang ist fehlgeschlagen',
    'error.validation.error': 'Validierungsfehler',
    'error.invalid.id.format': 'Ungültiges ID-Format',
    'error.duplicate.field': 'Dieser Wert wurde bereits verwendet',
    'error.route.not.found': 'Route nicht gefunden',
    'error.internal.server.error': 'Ein interner Serverfehler ist aufgetreten',
    
    // Validation messages
    'validation.email.required': 'E-Mail-Adresse ist erforderlich',
    'validation.password.required': 'Passwort ist erforderlich',
    'validation.name.required': 'Name ist erforderlich',
    'validation.phone.required': 'Telefonnummer ist erforderlich',
    'validation.gender.required': 'Geschlecht ist erforderlich',
    'validation.dob.required': 'Geburtsdatum ist erforderlich',
    'validation.symptoms.required': 'Symptom-Array ist erforderlich',
    'validation.period.start.required': 'Periodenstartdatum ist erforderlich',
    'validation.cycle.length.required': 'Zykluslänge ist erforderlich',
    'validation.period.duration.required': 'Periodendauer ist erforderlich',
    
    // OTP messages
    'otp.sent': 'OTP erfolgreich gesendet',
    'otp.verified': 'OTP erfolgreich verifiziert',
    'otp.not.found': 'Für diese E-Mail-Adresse wurde kein OTP gefunden',
    'otp.expired': 'OTP ist abgelaufen',
    'otp.already.used': 'Das OTP wurde bereits verwendet',
    'otp.max.attempts': 'Maximale Anzahl an OTP-Versuchen überschritten',
    'otp.invalid': 'Ungültiges OTP',
    'otp.failed.to.send': 'Das OTP konnte nicht gesendet werden',
    'otp.verification.failed': 'Die OTP-Verifizierung ist fehlgeschlagen',
    'otp.if.email.exists': 'Falls die E-Mail-Adresse existiert, wurde ein OTP gesendet',
    
    // Token messages
    'token.required': 'Für die Registrierung ist ein temporärer Token erforderlich',
    'token.email.mismatch': 'Der E-Mail-Verifizierungstoken stimmt nicht mit der Registrierungs-E-Mail überein.',
    
    // Registration/Login messages
    'registration.missing.fields': 'Pflichtfelder fehlen',
    'registration.field.required': '{field} ist erforderlich',
    'registration.password.mismatch': 'Passwort und Passwortbestätigung stimmen nicht überein',
    'login.email.password.required': 'E-Mail und Passwort sind erforderlich',
    'login.invalid.credentials': 'Ungültige E-Mail-Adresse oder Passwort',
    'login.failed': 'Anmeldung fehlgeschlagen',
    'auth.sso.missing.fields': 'Anbieter und idToken sind erforderlich',
    'auth.sso.invalid.provider': 'Ungültiger SSO-Anbieter. Verwende google oder apple',
    'auth.sso.invalid.token': 'Ungültiges oder abgelaufenes Anmelde-Token',
    'auth.sso.not.configured': 'SSO ist auf dem Server nicht konfiguriert',
    'auth.sso.email.required': 'E-Mail ist bei der ersten Anmeldung mit Apple erforderlich',
    'auth.sso.email.account.exists': 'Diese E-Mail ist mit einem Passwort registriert. Bitte melde dich mit E-Mail und Passwort an',
    'auth.sso.provider.account.exists': 'Diese E-Mail ist mit einer anderen Anmeldemethode registriert',
    'auth.sso.user.not.found': 'Kein Konto gefunden. Bitte registriere dich zuerst',
    'auth.sso.account.exists.try.login': 'Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an',
    'auth.login.use.sso': 'Bitte melde dich mit Google oder Apple an',
    'auth.login.no.password': 'Passwort-Anmeldung ist für dieses Konto nicht verfügbar',
    'auth.reset.password.sso.only': 'Passwort zurücksetzen ist nur für E-Mail-Konten verfügbar',
    'auth.forgot.password.use.google': 'Dieses Konto nutzt Google-Anmeldung. Ein Passwort-Reset ist nicht möglich. Bitte gehe zurück und melde dich mit Google an.',
    'auth.forgot.password.use.apple': 'Dieses Konto nutzt Apple-Anmeldung. Ein Passwort-Reset ist nicht möglich. Bitte gehe zurück und melde dich mit Apple an.',
    'personalization.incomplete': 'Bitte fülle alle erforderlichen Profilfelder aus',
    'personalization.completed': 'Profil erfolgreich vervollständigt',
    
    // Validation messages (additional)
    'validation.invalid.symptom': 'Ungültiges Symptom: {symptom}. Erlaubte Symptome sind: {allowed}',
    'validation.invalid.date.format': 'Ungültiges Datumsformat. Bitte verwende JJJJ-MM-TT',
    'validation.cannot.modify.past': 'Symptome aus vergangenen Tagen können nicht geändert werden',
    'validation.no.symptom.entry': 'Für heute wurde kein Symptomeintrag gefunden. Bitte gib zuerst deine Symptome ein.',
    'validation.symptom.entry.exists': 'Für dieses Datum existiert bereits ein Symptomeintrag',
    'validation.symptom.entry.not.found': 'Täglicher Symptomeintrag nicht gefunden',
    'validation.insights.invalid.filter': 'Ungültiger Filter. Verwende today, 7d, 30d oder custom',
    'validation.insights.dates.required': 'startDate und endDate sind erforderlich, wenn filter custom ist',
    'validation.insights.end.before.start': 'endDate muss am oder nach startDate liegen',
    'validation.insights.range.too.long': 'Der benutzerdefinierte Datumsbereich darf 365 Tage nicht überschreiten',
    'validation.insights.invalid.groupBy': 'Ungültiges groupBy. Verwende symptom oder day',
    'validation.insights.invalid.view': 'Ungültige view. Verwende phases, cycleList oder cycleDetail',
    'validation.insights.cycle.not.found': 'Zyklus nicht gefunden',
    'validation.insights.cycle.not.in.range': 'Zyklus liegt außerhalb des gewählten Zeitraums',
    'validation.insights.filter.not.allowed.for.phases': 'Datumsfilter gilt nicht für Phasen-Insights',
    'validation.flowInsights.invalid.view': 'Ungültige view. Verwende overview, cycleList oder cycleDetail',
    'flowInsights.access.denied': 'Abonnieren, um Menstruationsfluss-Insights freizuschalten',
    
    // Operation failed messages
    'failed.create.user': 'Das Benutzerkonto konnte nicht erstellt werden',
    'failed.retrieve.user': 'Benutzerdaten konnten nicht abgerufen werden',
    'failed.update.user': 'Benutzerdaten konnten nicht aktualisiert werden',
    'failed.update.profile': 'Das Benutzerprofil konnte nicht aktualisiert werden',
    'failed.update.picture': 'Das Profilbild konnte nicht aktualisiert werden',
    'failed.delete.picture': 'Das Profilbild konnte nicht gelöscht werden',
    'failed.delete.account': 'Das Konto konnte nicht gelöscht werden',
    'failed.reset.password': 'Das Passwort konnte nicht zurückgesetzt werden',
    'failed.submit.symptoms': 'Die täglichen Symptome konnten nicht übermittelt werden',
    'failed.update.symptoms': 'Die täglichen Symptome konnten nicht aktualisiert werden',
    'failed.retrieve.symptoms': 'Die täglichen Symptome konnten nicht abgerufen werden',
    'failed.retrieve.symptom.history': 'Der Symptomverlauf konnte nicht abgerufen werden',
    'failed.retrieve.symptom.date': 'Die Symptome für das ausgewählte Datum konnten nicht abgerufen werden',
    'failed.delete.symptom': 'Der tägliche Symptomeintrag konnte nicht gelöscht werden',
    'failed.retrieve.symptom.insights': 'Symptom-Insights konnten nicht abgerufen werden',
    'failed.retrieve.symptom.insights.byCycle': 'Symptom-Insights konnten nicht abgerufen werden',
    'failed.retrieve.symptom.insights.patterns': 'Symptommuster konnten nicht abgerufen werden',
    'failed.retrieve.flow.insights': 'Menstruationsfluss-Insights konnten nicht abgerufen werden',

    // Symptom insights patterns
    'symptomInsights.patterns.emptySummary': 'Wir lernen deinen Zyklus noch kennen. Tracke weiter, um deine persönlichen Symptommuster zu entdecken.',
    'symptomInsights.patterns.cyclesSummary': '{x} von deinen letzten {n} erfassten Zyklen',
    'symptomInsights.patterns.phaseCount': '{count} Mal in der {phase}phase',
    'symptomInsights.patterns.phaseCountSingular': '1 Mal in der {phase}phase',
    'symptomInsights.patterns.phaseName.menstrual': 'Menstruations',
    'symptomInsights.patterns.phaseName.follicular': 'Follikel',
    'symptomInsights.patterns.phaseName.ovulatory': 'Ovulations',
    'symptomInsights.patterns.phaseName.luteal': 'Luteal',
    
    // Feature and voting messages
    'feature.id.required': 'Feature-ID ist erforderlich',
    'feature.id.invalid': 'Ungültige Feature-ID',
    'feature.already.voted': 'Du hast für dieses Feature bereits abgestimmt',
    'feature.vote.submitted': 'Abstimmung erfolgreich übermittelt',
    'idea.required': 'Idee ist erforderlich',
    'idea.too.long': 'Die Idee darf maximal 1000 Zeichen lang sein',
    'idea.submitted': 'Idee erfolgreich übermittelt',
    
    // System messages
    'welcome.message': 'Willkommen bei der women-help-api Backend API',
    'no.period.date': 'Kein Periodenstartdatum vorhanden. Bitte gib zuerst den Start deiner letzten Periode an.',
    'cycle.ended': 'Zyklus ist beendet',
    'cycle.ongoing': 'Zyklus läuft noch',
    
    // Subscription plan messages
    'subscription.plans.retrieved': 'Abonnementspläne erfolgreich abgerufen',
    'subscription.plan.created': 'Abonnementsplan erfolgreich erstellt',
    'subscription.plan.set.success': 'Abonnementplan erfolgreich festgelegt',
    'subscription.plan.retrieved': 'Abonnementsplan erfolgreich abgerufen',
    'subscription.plan.renewed': 'Abonnementsplan erfolgreich erneuert',
    'subscription.plan.name.required': 'Name ist erforderlich',
    'subscription.plan.tag.required': 'Tag ist erforderlich',
    'subscription.plan.amount.required': 'Betrag ist erforderlich',
    'subscription.plan.impact.required': 'Impact ist erforderlich',
    'subscription.plan.description.required': 'Beschreibung ist erforderlich',
    'subscription.plan.currencyName.required': 'Währungsname ist erforderlich',
    'subscription.plan.currencySymbol.required': 'Währungssymbol ist erforderlich',
    'subscription.plan.duration.required': 'Dauer ist erforderlich',
    'subscription.plan.id.required': 'Abonnementsplan-ID ist erforderlich',
    'subscription.plan.not.found': 'Abonnementsplan nicht gefunden',
    'failed.get.subscription.plans': 'Die Abonnementpläne konnten nicht abgerufen werden',
    'failed.create.subscription.plan': 'Der Abonnementplan konnte nicht erstellt werden',
    'failed.set.subscription.plan': 'Der Abonnementplan konnte nicht festgelegt werden',
    'failed.get.subscription.plan': 'Der Abonnementplan konnte nicht abgerufen werden',
    'failed.renew.subscription.plan': 'Der Abonnementplan konnte nicht erneuert werden',
    
    // Stripe subscription messages
    'subscription.canceled.immediately': 'Das Abonnement wurde sofort beendet',
    'subscription.canceled.at.period.end': 'Das Abonnement endet zum Ende des aktuellen Abrechnungszeitraums.',
    'subscription.status.fetch.failed': 'Abonnementstatus konnte nicht geladen werden',

    // Impact messages
    'impact.targetCount.set.success': 'Zielanzahl erfolgreich gesetzt',
    'impact.collective.progress.retrieved': 'Der kollektive Fortschritt wurde erfolgreich abgerufen',
    'impact.user.retrieved': 'Dein Impact wurde erfolgreich abgerufen',
    'impact.targetCount.required': 'Zielanzahl ist erforderlich',
    'impact.targetCount.invalid': 'Die Zielanzahl muss eine gültige Zahl sein',
    'impact.targetCount.positive': 'Die Zielanzahl muss größer als 0 sein',
    'failed.set.target.count': 'Die Zielanzahl konnte nicht festgelegt werden',
    'failed.get.collective.progress': 'Der kollektive Fortschritt konnte nicht abgerufen werden',
    'failed.get.user.impact': 'Dein Impact konnte nicht abgerufen werden',

    // Per-plan "yourImpact" copy returned by GET /api/impact/user-impact
    'impact.yourImpact.impact': 'Du hast 1 Monat Zugang zu Menstruationsprodukten ermöglicht',
    'impact.yourImpact.plus': 'Du hast 5 Monate Zugang zu Menstruationsprodukten ermöglicht',
    'impact.yourImpact.max': 'Du hast 12 Monate Zugang zu Menstruationsprodukten ermöglicht',
    'impact.yourImpact.impactLegacyYearly': 'Du hast 3 Monate Zugang zu Menstruationsprodukten ermöglicht',
    
    // women-help-api support messages
    'women-help-api.support.added.success': 'Du wurdest erfolgreich zur women-help-api-Support-Warteliste hinzugefügt.',
    'women-help-api.support.check.success': 'Der Status der women-help-api-Support-Liste wurde erfolgreich abgerufen.',
    'women-help-api.support.location.required': 'Standort ist erforderlich',
    'women-help-api.support.already.added': 'Du bist bereits auf der Warteliste',
    'failed.add.women-help-api.support': 'Das Hinzufügen zur women-help-api-Support-Liste ist fehlgeschlagen.',
    'failed.check.women-help-api.support': 'Der Status der women-help-api-Support-Liste konnte nicht überprüft werden.',
    
    // Invite link messages
    'invite.links.stored.success': 'Einladungslinks erfolgreich gespeichert',
    'invite.link.retrieved.success': 'Einladungslink erfolgreich abgerufen',
    'invite.unavailable': 'Einladung nicht verfügbar, bitte versuchen Sie es später erneut.',
    'invite.data.required': 'Einladungsdaten sind erforderlich',
    'invite.key.invalid': 'Ungültiger Einladungsschlüssel. Muss einer von sein: android, ios, dynamic',
    'failed.store.invite.links': 'Speichern der Einladungslinks fehlgeschlagen',
    'failed.get.invite.link': 'Abrufen des Einladungslinks fehlgeschlagen'
  }
};

/**
 * Get localized message for a given key and language
 * @param {string} key - Message key
 * @param {string} language - Language code (en or de)
 * @param {Object} params - Optional parameters for message interpolation
 * @returns {string} Localized message
 */
const getLocalizedMessage = (key, language = 'en', params = {}) => {
  // Validate language
  const validLanguages = ['en', 'de'];
  const lang = validLanguages.includes(language) ? language : 'en';
  
  // Get message from the specified language, fallback to English
  let message = MESSAGES[lang][key] || MESSAGES['en'][key];
  
  // If message not found in either language, return the key itself
  if (!message) {
    console.warn(`Localization key "${key}" not found for language "${lang}"`);
    return key;
  }
  
  // Simple parameter interpolation (replace {param} with actual values)
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      const placeholder = `{${param}}`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
  }
  
  return message;
};

/**
 * Get localized message from request object (uses req.language)
 * @param {string} key - Message key
 * @param {Object} req - Express request object (must have req.language)
 * @param {Object} params - Optional parameters for message interpolation
 * @returns {string} Localized message
 */
const getLocalizedMessageFromRequest = (key, req, params = {}) => {
  const language = req.language || 'en';
  return getLocalizedMessage(key, language, params);
};

/**
 * Get all available languages
 * @returns {Array} Array of supported language codes
 */
const getAvailableLanguages = () => {
  return Object.keys(MESSAGES);
};

/**
 * Check if a language is supported
 * @param {string} language - Language code to check
 * @returns {boolean} True if language is supported
 */
const isLanguageSupported = (language) => {
  return Object.keys(MESSAGES).includes(language);
};

/**
 * Get all messages for a specific language
 * @param {string} language - Language code
 * @returns {Object} All messages for the language
 */
const getMessagesForLanguage = (language) => {
  return MESSAGES[language] || MESSAGES['en'];
};

module.exports = {
  getLocalizedMessage,
  getLocalizedMessageFromRequest,
  getAvailableLanguages,
  isLanguageSupported,
  getMessagesForLanguage,
  MESSAGES,
  SUPPORTED_LANGUAGES: ['en', 'de']
};
