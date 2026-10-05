import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAvatar,
  IonIcon,
  IonCard,
  IonCardContent,
  IonInput,
  IonButton,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { keyOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { feldFehler } from '../../shared/formular.utils';

// Validator sitzt am passwortBestaetigung-Control selbst (nicht an der FormGroup),
// damit Ionic den Fehlerzustand über die automatisch gespiegelten ng-*-Klassen
// dieses Controls korrekt anzeigt (siehe @ionic/angular ValueAccessor) - analog
// zum selben Muster in der Registrierung.
function passwortBestaetigungStimmtUeberein(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const passwort = control.parent?.get('neuesPasswort')?.value;
    return control.value === passwort ? null : { passwoerterUngleich: true };
  };
}

@Component({
  selector: 'app-passwort-zuruecksetzen',
  templateUrl: 'passwort-zuruecksetzen.page.html',
  styleUrls: ['passwort-zuruecksetzen.page.scss', '../auth-shared.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonAvatar,
    IonIcon,
    IonCard,
    IonCardContent,
    IonInput,
    IonButton,
    IonSpinner,
  ],
})
export class PasswortZuruecksetzenPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.nonNullable.group({
    neuesPasswort: ['', [Validators.required, Validators.minLength(6)]],
    passwortBestaetigung: ['', [Validators.required, passwortBestaetigungStimmtUeberein()]],
  });

  readonly tokenWirdGeprueft = signal(true);
  readonly tokenGueltig = signal(false);
  readonly wirdGeladen = signal(false);

  constructor() {
    addIcons({ keyOutline });

    // Bestätigungsfeld neu validieren, wenn das Passwort nachträglich geändert wird.
    this.form.controls.neuesPasswort.valueChanges.subscribe(() => {
      this.form.controls.passwortBestaetigung.updateValueAndValidity({ onlySelf: true });
    });
  }

  ngOnInit(): void {
    // Der Recovery-Link landet mit einem Token im URL-Hash; Supabase
    // verarbeitet ihn automatisch beim Client-Start und feuert dafür einmalig
    // das Event PASSWORD_RECOVERY.
    const {
      data: { subscription },
    } = this.supabaseService.supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.tokenGueltig.set(true);
        this.tokenWirdGeprueft.set(false);
      }
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());

    // Zusätzlich den aktuellen Zustand direkt prüfen: Falls die Seite erst
    // nach dem Verarbeiten des Links geladen wurde (z.B. weil ein anderer,
    // schon länger bestehender Listener zuerst dran war), wäre das einmalige
    // Event sonst bereits verpasst - eine bestehende Session reicht dann als
    // Nachweis für einen gültigen Link.
    void this.supabaseService.supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.tokenGueltig.set(true);
      }
      this.tokenWirdGeprueft.set(false);
    });
  }

  neuesPasswortFehler(): string | undefined {
    return feldFehler(this.form.controls.neuesPasswort, 'Passwort muss mindestens 6 Zeichen lang sein.', {
      required: 'Neues Passwort ist ein Pflichtfeld.',
    });
  }

  passwortBestaetigungFehler(): string | undefined {
    return feldFehler(this.form.controls.passwortBestaetigung, 'Die Passwörter stimmen nicht überein.', {
      required: 'Passwort-Bestätigung ist ein Pflichtfeld.',
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { neuesPasswort } = this.form.getRawValue();

    this.wirdGeladen.set(true);
    try {
      await this.authService.neuesPasswortSetzen(neuesPasswort);
      const toast = await this.toastController.create({
        message: 'Passwort erfolgreich geändert. Bitte melde dich neu an.',
        duration: 3000,
        color: 'success',
        position: 'top',
      });
      await toast.present();
      // Session bewusst beenden statt die Person automatisch eingeloggt zu
      // lassen - sie soll sich mit dem neuen Passwort bewusst neu anmelden.
      await this.authService.logout();
      this.router.navigateByUrl('/auth/anmeldung');
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Passwort konnte nicht geändert werden.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.wirdGeladen.set(false);
    }
  }
}
