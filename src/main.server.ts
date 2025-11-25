import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

export default function bootstrap(context: unknown) {
	return bootstrapApplication(AppComponent, {
		providers: [provideRouter(routes)]
	});
}
