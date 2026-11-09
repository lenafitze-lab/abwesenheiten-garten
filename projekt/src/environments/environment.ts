// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  supabaseUrl: 'https://uhiimwrodijawbtnpdyf.supabase.co',
  supabaseKey: 'sb_publishable_kiKlOtlW8a68r5NzWO05og_0jZ4Cant',
  // Öffentlicher VAPID-Key für Web Push (npx web-push generate-vapid-keys).
  // Der private Key gehört NUR als Secret zu Supabase, nie hierher.
  vapidPublicKey: ''
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
