#!/bin/bash

echo "Choisir la méthode de déploiement :"
echo "1) GitHub Pages"
echo "2) Vercel"
read -p "Entrez 1 ou 2 : " choice

if [ "$choice" == "1" ]; then
  echo "Déploiement sur GitHub Pages..."
  cp config/package.github.json package.json
  npm install
  npm run deploy
elif [ "$choice" == "2" ]; then
  echo "Déploiement sur Vercel..."
  cp config/package.vercel.json package.json
  npm install
  vercel --prod
else
  echo "Choix invalide. Veuillez entrer 1 ou 2."
fi
 # rendre le fichier executable (normalement une fois suffit) : chmod +x deploy.sh
 # lancer le script : ./deploy.sh