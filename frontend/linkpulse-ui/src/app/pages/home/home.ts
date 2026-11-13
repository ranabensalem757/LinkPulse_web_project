import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  protected readonly keyFigures = [
    { value: '30s', label: 'Fréquence des contrôles sondes' },
    { value: '0%', label: 'Faux positifs sur la cible' },
    { value: '10s', label: 'Mise en route, montre en main' },
  ];

  protected readonly features = [
    {
      title: 'Surveillance continue',
      text: 'Sondes régionales qui contrôlent vos sites en continu et relèvent les micro-coupures réelles, pas seulement une page d’accueil.',
      link: 'Réseau distribué',
    },
    {
      title: 'Alertes sans jargon',
      text: 'Les codes HTTP, délais et erreurs DNS sont traduits en phrases claires. Toute l’équipe comprend ce qui se passe.',
      link: 'Graphiques clairs',
    },
    {
      title: 'Historique & preuves',
      text: 'Chaque contrôle est horodaté. Le journal garde la trace, la sonde et le code pour expliquer un incident.',
      link: 'Audit exploitable',
    },
    {
      title: 'Espace sécurisé',
      text: 'Connexion personnelle, chiffrement des échanges et séparation stricte : chacun ne voit que ses propres sites.',
      link: 'Zone isolée',
    },
  ];

  protected readonly steps = [
    {
      number: '01',
      title: 'Créez un compte',
      text: 'Ouvrez votre espace en quelques secondes et accédez à la console de supervision.',
    },
    {
      number: '02',
      title: 'Ajoutez votre URL',
      text: 'Collez l’adresse de votre site ou de votre point de terminaison. Aucun agent à installer.',
    },
    {
      number: '03',
      title: 'Suivez la santé de vos services',
      text: 'Les sondes prennent le relais. Une alerte n’apparaît que lorsqu’un problème est confirmé.',
    },
  ];
}
