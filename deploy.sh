#!/bin/bash

echo "Choisir la méthode de déploiement :"
echo "1) GitHub Pages"
echo "2) Vercel"
read -p "Entrez 1 ou 2 : " choice

if [ "$choice" == "1" ]; then
  echo "Déploiement sur GitHub Pages..."
  npm run deploy  # Assurez-vous que le script "deploy" est correctement configuré dans votre package.json
elif [ "$choice" == "2" ]; then
  echo "Déploiement sur Vercel..."
  vercel --prod
else
  echo "Choix invalide. Veuillez entrer 1 ou 2."
fi

 # rendre le fichier executable (normalement une fois suffit) : chmod +x deploy.sh
 # lancer le script : ./deploy.sh