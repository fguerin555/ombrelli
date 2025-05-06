const fs = require("fs");
const path = require("path");

const buildDir = path.resolve(__dirname, "../build");
const indexHtmlPath = path.join(buildDir, "index.html");
const fourOhFourHtmlPath = path.join(buildDir, "404.html");
const noJekyllPath = path.join(buildDir, ".nojekyll");

const scriptToAppendTo404 = `
<script type="text/javascript">
  // Single Page Apps for GitHub Pages
  // https://github.com/rafgraph/spa-github-pages
  // This script takes the current url and converts the path and query
  // string into just a query string, and then redirects the browser
  // to the new url with only a query string and hash fragment.
  var segmentCount = 1; // IMPORTANT: Ceci doit être à 1 pour /ombrelli (si votre repo est fguerin555.github.io/ombrelli)
  var l = window.location;
  l.replace(
    l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
    l.pathname.split('/').slice(0, 1 + segmentCount).join('/') + '/?p=/' +
    l.pathname.slice(1).split('/').slice(segmentCount).join('/').replace(/&/g, '~and~') +
    (l.search ? '&q=' + l.search.slice(1).replace(/&/g, '~and~') : '') +
    l.hash
  );
</script>
`;

try {
  // 1. Vérifie si build/index.html existe
  if (!fs.existsSync(indexHtmlPath)) {
    console.error(
      'Erreur: Le fichier build/index.html est introuvable. Exécutez "npm run build" d\'abord.'
    );
    process.exit(1);
  }

  // 2. Lit le contenu de build/index.html, ajoute le script spécifique au 404, et écrit dans build/404.html
  let indexContent = fs.readFileSync(indexHtmlPath, "utf8");
  // Ajoute le script avant la balise </body>
  const modifiedContentFor404 = indexContent.replace(
    "</body>", // Recherche la balise </body>
    scriptToAppendTo404 + "</body>" // Insère le script avant </body>
  );
  fs.writeFileSync(fourOhFourHtmlPath, modifiedContentFor404);
  console.log("Fichier build/404.html créé et modifié avec succès.");

  // 3. Crée le fichier .nojekyll
  // Si tu as ajouté .nojekyll dans ton dossier /Users/fredericguerin/Desktop/ombrelli/public/,
  // cette ligne n'est techniquement plus indispensable, mais elle ne fait pas de mal
  // car elle s'assurera qu'un fichier .nojekyll vide existe bien à la racine de build/.
  fs.writeFileSync(noJekyllPath, "");
  console.log("Fichier build/.nojekyll créé avec succès.");
} catch (error) {
  console.error("Erreur durant la préparation pour GitHub Pages:", error);
  process.exit(1);
}
