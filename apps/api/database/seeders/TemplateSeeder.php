<?php

namespace Database\Seeders;

use App\Models\Template;
use Illuminate\Database\Seeder;

class TemplateSeeder extends Seeder
{
    public function run(): void
    {
        // Create a system workspace and database to satisfy database_id constraints
        $systemWorkspace = \App\Models\Workspace::firstOrCreate(
            ['name' => 'Modèles de Système'],
            ['id' => '018f3a3d-4c3a-4467-9c97-6a1a0c0a0000']
        );

        $systemDatabase = \App\Models\Database::firstOrCreate(
            ['name' => 'Base de données système', 'workspace_id' => $systemWorkspace->id],
            ['id' => '018f3a3d-4c3a-4467-9c97-6a1a0c0a0001', 'locale' => 'fr-CA']
        );

        // 1. Literary Catalog Template
        $literaryCatalogPayload = [
            'database' => [
                'name' => 'Catalogue Littéraire',
                'locale' => 'fr-CA',
            ],
            'tables' => [
                [
                    'key' => 'authors',
                    'name' => 'Auteurs',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                        ['key' => 'prenom', 'name' => 'Prénom', 'type' => 'text', 'position' => 1, 'options' => ['max_length' => 255]],
                        ['key' => 'naissance', 'name' => 'Naissance', 'type' => 'date', 'position' => 2, 'options' => ['precision' => 'year']],
                        ['key' => 'deces', 'name' => 'Décès', 'type' => 'date', 'position' => 3, 'options' => ['precision' => 'year']],
                        ['key' => 'lien', 'name' => 'Notice biographique URL', 'type' => 'url', 'position' => 4],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'publishers',
                    'name' => 'Éditeurs',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'printers',
                    'name' => 'Imprimeurs',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'locations',
                    'name' => 'Localisations',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom de l\'établissement', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'genres',
                    'name' => 'Genres',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'categories',
                    'name' => 'Catégories',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'frequencies',
                    'name' => 'Fréquences',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'lengths',
                    'name' => 'Longueurs',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Type d\'unité', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'periodicals',
                    'name' => 'Périodiques',
                    'fields' => [
                        ['key' => 'titre', 'name' => 'Titre', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                        ['key' => 'proprietaire', 'name' => 'Propriétaire', 'type' => 'text', 'position' => 1, 'options' => ['max_length' => 255]],
                        ['key' => 'debut', 'name' => 'Début de parution', 'type' => 'date', 'position' => 2, 'options' => ['precision' => 'year']],
                        ['key' => 'fin', 'name' => 'Fin de parution', 'type' => 'date', 'position' => 3, 'options' => ['precision' => 'year']],
                        ['key' => 'description_courte', 'name' => 'Description courte', 'type' => 'text', 'position' => 4, 'options' => ['max_length' => 140]],
                        ['key' => 'description', 'name' => 'Description', 'type' => 'long_text', 'position' => 5],
                        ['key' => 'images', 'name' => 'Images', 'type' => 'image', 'position' => 6],
                        ['key' => 'notes', 'name' => 'Notes', 'type' => 'long_text', 'position' => 7],
                        ['key' => 'imprimeur', 'name' => 'Imprimeur', 'type' => 'reference', 'position' => 8, 'options' => ['target_table' => 'printers', 'multi' => false]],
                        ['key' => 'editeur', 'name' => 'Éditeur', 'type' => 'reference', 'position' => 9, 'options' => ['target_table' => 'publishers', 'multi' => false]],
                        ['key' => 'frequence', 'name' => 'Fréquence', 'type' => 'reference', 'position' => 10, 'options' => ['target_table' => 'frequencies', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'works',
                    'name' => 'Ouvrages',
                    'fields' => [
                        ['key' => 'titre', 'name' => 'Titre', 'type' => 'text', 'position' => 0],
                        ['key' => 'description', 'name' => 'Description', 'type' => 'long_text', 'position' => 1],
                        ['key' => 'description_courte', 'name' => 'Description courte', 'type' => 'text', 'position' => 2, 'options' => ['max_length' => 140]],
                        ['key' => 'images', 'name' => 'Images', 'type' => 'image', 'position' => 3],
                        ['key' => 'annee_publication', 'name' => 'Année de publication', 'type' => 'number', 'position' => 4, 'options' => ['decimal' => false]],
                        ['key' => 'mois_publication', 'name' => 'Mois de publication', 'type' => 'number', 'position' => 5, 'options' => ['decimal' => false]],
                        ['key' => 'nombre_pages', 'name' => 'Nombre de pages', 'type' => 'number', 'position' => 6, 'options' => ['decimal' => false]],
                        ['key' => 'nombre_editions', 'name' => 'Nombre d\'éditions', 'type' => 'number', 'position' => 7, 'options' => ['decimal' => false]],
                        ['key' => 'notes', 'name' => 'Notes', 'type' => 'long_text', 'position' => 8],
                        ['key' => 'auteur', 'name' => 'Auteur', 'type' => 'reference', 'position' => 9, 'options' => ['target_table' => 'authors', 'multi' => false]],
                        ['key' => 'type', 'name' => 'Genre', 'type' => 'reference', 'position' => 10, 'options' => ['target_table' => 'genres', 'multi' => false]],
                        ['key' => 'categorie', 'name' => 'Catégorie', 'type' => 'reference', 'position' => 11, 'options' => ['target_table' => 'categories', 'multi' => false]],
                        ['key' => 'editeur', 'name' => 'Éditeur', 'type' => 'reference', 'position' => 12, 'options' => ['target_table' => 'publishers', 'multi' => false]],
                        ['key' => 'imprimeur', 'name' => 'Imprimeur', 'type' => 'reference', 'position' => 13, 'options' => ['target_table' => 'printers', 'multi' => false]],
                        ['key' => 'localisation', 'name' => 'Localisation', 'type' => 'reference', 'position' => 14, 'options' => ['target_table' => 'locations', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'issues',
                    'name' => 'Numéros',
                    'fields' => [
                        ['key' => 'code', 'name' => 'Numéro / Code', 'type' => 'text', 'position' => 0],
                        ['key' => 'date', 'name' => 'Date', 'type' => 'date', 'position' => 1, 'options' => ['precision' => 'full']],
                        ['key' => 'publicite', 'name' => 'Publicité', 'type' => 'boolean', 'position' => 2],
                        ['key' => 'localisation', 'name' => 'Localisation physique', 'type' => 'long_text', 'position' => 3],
                        ['key' => 'periodique', 'name' => 'Périodique', 'type' => 'reference', 'position' => 4, 'options' => ['target_table' => 'periodicals', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'articles',
                    'name' => 'Articles',
                    'fields' => [
                        ['key' => 'titre', 'name' => 'Titre', 'type' => 'text', 'position' => 0],
                        ['key' => 'description', 'name' => 'Description', 'type' => 'long_text', 'position' => 1],
                        ['key' => 'description_courte', 'name' => 'Description courte', 'type' => 'text', 'position' => 2, 'options' => ['max_length' => 140]],
                        ['key' => 'quantite_longueur', 'name' => 'Quantité longueur', 'type' => 'number', 'position' => 3],
                        ['key' => 'de', 'name' => 'De la page', 'type' => 'number', 'position' => 4],
                        ['key' => 'a', 'name' => 'À la page', 'type' => 'number', 'position' => 5],
                        ['key' => 'consultation', 'name' => 'Date de consultation', 'type' => 'date', 'position' => 6, 'options' => ['precision' => 'full']],
                        ['key' => 'images', 'name' => 'Images', 'type' => 'image', 'position' => 7],
                        ['key' => 'auteur', 'name' => 'Auteur', 'type' => 'reference', 'position' => 8, 'options' => ['target_table' => 'authors', 'multi' => false]],
                        ['key' => 'numero', 'name' => 'Numéro', 'type' => 'reference', 'position' => 9, 'options' => ['target_table' => 'issues', 'multi' => false]],
                        ['key' => 'longueur', 'name' => 'Longueur', 'type' => 'reference', 'position' => 10, 'options' => ['target_table' => 'lengths', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'illustrations',
                    'name' => 'Illustrations',
                    'fields' => [
                        ['key' => 'auteur', 'name' => 'Auteur', 'type' => 'text', 'position' => 0],
                        ['key' => 'medium', 'name' => 'Médium', 'type' => 'text', 'position' => 1],
                        ['key' => 'description', 'name' => 'Description', 'type' => 'long_text', 'position' => 2],
                        ['key' => 'images', 'name' => 'Images', 'type' => 'image', 'position' => 3],
                        ['key' => 'page', 'name' => 'Page', 'type' => 'number', 'position' => 4],
                        ['key' => 'article', 'name' => 'Article', 'type' => 'reference', 'position' => 5, 'options' => ['target_table' => 'articles', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
            ],
            'demo_records' => [
                [
                    'table' => 'authors',
                    'records' => [
                        [
                            'id' => 'ref-author-badeaux',
                            'nom' => 'Badeaux',
                            'prenom' => 'Jean-Baptiste',
                            'naissance' => '1741-00-00',
                            'deces' => '1796-00-00',
                            'lien' => 'https://www.biographi.ca/fr/bio/badeaux_jean_baptiste_4F.html',
                        ],
                    ],
                ],
                [
                    'table' => 'publishers',
                    'records' => [
                        [
                            'id' => 'ref-publisher-senecal',
                            'nom' => 'Eusèbe Senécal, imprimeur-éditeur',
                        ],
                    ],
                ],
                [
                    'table' => 'printers',
                    'records' => [
                        [
                            'id' => 'ref-printer-senecal',
                            'nom' => 'Eusèbe Senécal, imprimeur',
                        ],
                    ],
                ],
                [
                    'table' => 'locations',
                    'records' => [
                        [
                            'id' => 'ref-location-banq',
                            'nom' => 'Bibliothèque et Archives nationales du Québec (BAnQ)',
                        ],
                    ],
                ],
                [
                    'table' => 'genres',
                    'records' => [
                        [
                            'id' => 'ref-genre-histoire',
                            'nom' => 'Histoire',
                        ],
                    ],
                ],
                [
                    'table' => 'categories',
                    'records' => [
                        [
                            'id' => 'ref-cat-histoire',
                            'nom' => 'Histoire',
                        ],
                    ],
                ],
                [
                    'table' => 'works',
                    'records' => [
                        [
                            'titre' => 'Journal des opérations de l\'armée américaine lors de l\'invasion du Canada en 1775-1776',
                            'description' => 'récits personnels, histoire, invasion américaine 1775-1776',
                            'description_courte' => 'histoire, invasion américaine 1775-1776',
                            'annee_publication' => 1871,
                            'nombre_pages' => 43,
                            'nombre_editions' => 2,
                            'notes' => 'cote: 971. 024 B133j 1927 Collection nationale, Réserve',
                            'auteur' => 'ref-author-badeaux',
                            'type' => 'ref-genre-histoire',
                            'categorie' => 'ref-cat-histoire',
                            'editeur' => 'ref-publisher-senecal',
                            'imprimeur' => 'ref-printer-senecal',
                            'localisation' => 'ref-location-banq',
                        ],
                    ],
                ],
            ],
        ];

        // 2. Recipe Box Template
        $recipeBoxPayload = [
            'database' => [
                'name' => 'Boîte à Recettes',
                'locale' => 'fr-CA',
            ],
            'tables' => [
                [
                    'key' => 'categories',
                    'name' => 'Catégories',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom de la catégorie', 'type' => 'text', 'position' => 0, 'options' => ['max_length' => 255]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'recipes',
                    'name' => 'Recettes',
                    'fields' => [
                        ['key' => 'titre', 'name' => 'Titre de la recette', 'type' => 'text', 'position' => 0],
                        ['key' => 'instructions', 'name' => 'Instructions', 'type' => 'long_text', 'position' => 1],
                        ['key' => 'prep_time', 'name' => 'Temps de préparation (min)', 'type' => 'number', 'position' => 2, 'options' => ['decimal' => false]],
                        ['key' => 'cook_time', 'name' => 'Temps de cuisson (min)', 'type' => 'number', 'position' => 3, 'options' => ['decimal' => false]],
                        ['key' => 'portions', 'name' => 'Portions', 'type' => 'number', 'position' => 4, 'options' => ['decimal' => false]],
                        ['key' => 'difficulte', 'name' => 'Difficulté', 'type' => 'text', 'position' => 5],
                        ['key' => 'notes', 'name' => 'Notes', 'type' => 'long_text', 'position' => 6],
                        ['key' => 'categorie', 'name' => 'Catégorie', 'type' => 'reference', 'position' => 7, 'options' => ['target_table' => 'categories', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
                [
                    'key' => 'ingredients',
                    'name' => 'Ingrédients',
                    'fields' => [
                        ['key' => 'nom', 'name' => 'Nom de l\'ingrédient', 'type' => 'text', 'position' => 0],
                        ['key' => 'quantite', 'name' => 'Quantité', 'type' => 'text', 'position' => 1],
                        ['key' => 'recette', 'name' => 'Recette associée', 'type' => 'reference', 'position' => 2, 'options' => ['target_table' => 'recipes', 'multi' => false]],
                    ],
                    'views' => [],
                    'reports' => [],
                ],
            ],
            'demo_records' => [
                [
                    'table' => 'categories',
                    'records' => [
                        [
                            'id' => 'ref-cat-dessert',
                            'nom' => 'Desserts',
                        ],
                    ],
                ],
                [
                    'table' => 'recipes',
                    'records' => [
                        [
                            'id' => 'ref-recipe-gateau',
                            'titre' => 'Gâteau au Chocolat Moelleux',
                            'instructions' => "1. Préchauffer le four à 180°C.\n2. Faire fondre le chocolat et le beurre.\n3. Ajouter le sucre, les oeufs et la farine.\n4. Cuire pendant 25-30 minutes.",
                            'prep_time' => 15,
                            'cook_time' => 30,
                            'portions' => 8,
                            'difficulte' => 'Facile',
                            'notes' => 'Délicieux accompagné d\'une boule de glace à la vanille.',
                            'categorie' => 'ref-cat-dessert',
                        ],
                    ],
                ],
                [
                    'table' => 'ingredients',
                    'records' => [
                        [
                            'nom' => 'Chocolat noir de cuisine',
                            'quantite' => '200g',
                            'recette' => 'ref-recipe-gateau',
                        ],
                        [
                            'nom' => 'Beurre doux',
                            'quantite' => '100g',
                            'recette' => 'ref-recipe-gateau',
                        ],
                    ],
                ],
            ],
        ];

        // Seed templates into the database using new and save
        $t1 = new Template();
        $t1->id = (string) \Illuminate\Support\Str::uuid();
        $t1->database_id = $systemDatabase->id;
        $t1->name = 'Catalogue Littéraire';
        $t1->description = 'Modèle complet pour cataloguer des oeuvres littéraires, périodiques, auteurs, éditeurs, imprimeurs, localisations, etc. (Basé sur la base de données historique Éusèbe Sénécal).';
        $t1->format_version = 1;
        $t1->template_version = '1.0.0';
        $t1->schema = $literaryCatalogPayload;
        $t1->payload = $literaryCatalogPayload;
        $t1->includes_demo_records = true;
        $t1->save();

        $t2 = new Template();
        $t2->id = (string) \Illuminate\Support\Str::uuid();
        $t2->database_id = $systemDatabase->id;
        $t2->name = 'Boîte à Recettes';
        $t2->description = 'Modèle simple et générique pour gérer vos recettes de cuisine préférées, leurs ingrédients et catégories.';
        $t2->format_version = 1;
        $t2->template_version = '1.0.0';
        $t2->schema = $recipeBoxPayload;
        $t2->payload = $recipeBoxPayload;
        $t2->includes_demo_records = true;
        $t2->save();
    }
}
