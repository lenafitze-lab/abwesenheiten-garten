import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { from, map, of } from 'rxjs';
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
  IonNote,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personAddOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { feldFehler } from '../../shared/formular.utils';

// Validator sitzt am passwortBestaetigung-Control selbst (nicht an der FormGroup),
// damit Ionic den Fehlerzustand über die automatisch gespiegelten ng-*-Klassen
// dieses Controls korrekt anzeigt (siehe @ionic/angular ValueAccessor).
function passwortBestaetigungStimmtUeberein(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const passwort = control.parent?.get('passwort')?.value;
    return control.value === passwort ? null : { passwoerterUngleich: true };
  };
}

function emailNochNichtRegistriert(authService: AuthService): AsyncValidatorFn {
  return (control: AbstractControl) => {
    if (!control.value) {
      return of(null);
    }
    return from(authService.isEmailRegistered(control.value)).pipe(
      map((registriert): ValidationErrors | null => (registriert ? { bereitsRegistriert: true } : null)),
    );
  };
}

@Component({
  selector: 'app-registrierung',
  templateUrl: 'registrierung.page.html',
  styleUrls: ['registrierung.page.scss', '../auth-shared.scss'],
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
    IonNote,
  ],
})
export class RegistrierungPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.email],
      asyncValidators: [emailNochNichtRegistriert(this.authService)],
      updateOn: 'blur',
    }),
    passwort: ['', [Validators.required, Validators.minLength(6)]],
    passwortBestaetigung: ['', [Validators.required, passwortBestaetigungStimmtUeberein()]],
    einladungscode: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ personAddOutline });

    // Bestätigungsfeld neu validieren, wenn das Passwort nachträglich geändert wird.
    this.form.controls.passwort.valueChanges.subscribe(() => {
      this.form.controls.passwortBestaetigung.updateValueAndValidity({ onlySelf: true });
    });
  }

  emailFehler(): string | undefined {
    return feldFehler(this.form.controls.email, 'Bitte eine gültige E-Mail-Adresse eingeben.', {
      required: 'E-Mail ist ein Pflichtfeld.',
      bereitsRegistriert: 'Für diese E-Mail-Adresse besteht bereits ein Konto.',
    });
  }

  passwortFehler(): string | undefined {
    return feldFehler(this.form.controls.passwort, 'Passwort muss mindestens 6 Zeichen lang sein.', {
      required: 'Passwort ist ein Pflichtfeld.',
    });
  }

  passwortBestaetigungFehler(): string | undefined {
    return feldFehler(this.form.controls.passwortBestaetigung, 'Die Passwörter stimmen nicht überein.', {
      required: 'Passwort-Bestätigung ist ein Pflichtfeld.',
    });
  }

  einladungscodeFehler(): string | undefined {
    return feldFehler(this.form.controls.einladungscode, 'Ungültiger Einladungscode.', {
      required: 'Einladungscode ist ein Pflichtfeld.',
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, passwort, einladungscode } = this.form.getRawValue();
    const resolution = this.authService.resolveRoleFromInviteCode(einladungscode);

    if (!resolution.valid) {
      this.form.controls.einladungscode.setErrors({ ungueltig: true });
      return;
    }

    this.authService.startRegistration(email, passwort, resolution);

    if (resolution.requiresRoleSelection) {
      this.router.navigateByUrl('/auth/registrierung/rolle');
    } else {
      this.router.navigateByUrl('/auth/registrierung/profil');
    }
  }
}
