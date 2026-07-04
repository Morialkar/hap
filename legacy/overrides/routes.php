<?php

/*
|--------------------------------------------------------------------------
| Application Routes — capsule override
|--------------------------------------------------------------------------
|
| Mounted OVER application/routes.php in the capsule (the v2 repo itself
| is read-only). Fixes applied vs the committed original:
|
|   1. move_uploaded_file: first argument was $img['name'] (client filename)
|      instead of $img['tmp_name'] (PHP temp path) — file never materialized.
|      Fixed in all four upload handlers (POST /ajouter/ouvrage,
|      POST /editer/ouvrage, POST /ajouter/periodique, POST /editer/periodique).
|
|   2. POST /editer/ouvrage response returned View::make('edit.periodique')
|      instead of View::make('edit.ouvrage') — wrong view on successful save.
|
| Everything else is byte-for-byte identical to the original.
|
*/

Route::get('/', function()
{
	return View::make('home.index');
});

/*
|--------------------------------------------------------------------------
| Routes de Visionnement
|--------------------------------------------------------------------------
|
| Pour séparer la section de visionnement du contenu
|
*/

Route::get('/annex', function(){
	return View::make('annex');
});
    /*
    |-------------------------
    | Ouvrages
    |-------------------------
    */
    
    //Voir par Titre
    Route::get('view/ouvrage/titre', function(){
        
        return View::make('view.ouvrage.titre');
    });

    Route::get('view/ouvrage/id/(:num)', function($id){
        $ouvrage = Ouvrage::find($id);
        return View::make('view.ouvrage.view')->with('ouvrage', $ouvrage);
    });

    //Voir par Auteur
    Route::get('view/ouvrage/auteurs', function(){
        
        return View::make('view.ouvrage.auteur');
    });

	Route::get('view/ouvrage/auteur/(:num)', function($auteur){
		$auteurVat = Auteur::find($auteur);
		$auteurNom = $auteurVat->nom . ', ' . $auteurVat->prenom;
        $ouvrage = Ouvrage::where('fk_auteur', '=', $auteur)->get();
        return View::make('view.ouvrage.auteur')->with('ouvrages', $ouvrage)->with('auteurNom', $auteurNom);
    });    

    //Voir par Dates
    Route::get('view/ouvrage/dates', function(){
        
        return View::make('view.ouvrage.dates');
    });

    Route::get('view/ouvrage/dates/(:num)', function($annee){
        $ouvrage = Ouvrage::where('annee_publication', '=', $annee)->get();
        return View::make('view.ouvrage.dates')->with('ouvrages', $ouvrage)->with('annee', $annee);
    });
    
    //Voir par Genre
    Route::get('view/ouvrage/genre', function(){
        
        return View::make('view.ouvrage.genre');
    });

    Route::get('view/ouvrage/genre/(:num)', function($auteur){
		$auteurVat = Type::find($auteur);
		$auteurNom = $auteurVat->nom;
        $ouvrage = Ouvrage::where('fk_type', '=', $auteur)->get();
        return View::make('view.ouvrage.auteur')->with('ouvrages', $ouvrage)->with('auteurNom', $auteurNom);
    }); 
    
    //Voir par Catégorie
    Route::get('view/ouvrage/categorie', function(){
        
        return View::make('view.ouvrage.categorie');
    });

    Route::get('view/ouvrage/categorie/(:num)', function($auteur){
		$auteurVat = Categorie::find($auteur);
		$auteurNom = $auteurVat->nom;
        $ouvrage = Ouvrage::where('fk_cat', '=', $auteur)->get();
        return View::make('view.ouvrage.auteur')->with('ouvrages', $ouvrage)->with('auteurNom', $auteurNom);
    }); 

    //Voir par Titre
    Route::get('view/periodique/titre', function(){
        
        return View::make('view.periodique.titre');
    });

    Route::get('view/periodique/id/(:num)', function($id){
        $ouvrage = Periodique::find($id);
        return View::make('view.periodique.view')->with('periodique', $ouvrage);
    });

/*
|--------------------------------------------------------------------------
| Routes d'ouvrages
|--------------------------------------------------------------------------
|
| Pour séparé la section ouvrages
|
*/

//Ajouter Ouvrage
Route::get('/ajouter/ouvrage', function(){
	return View::make('add.ouvrage')->with('ok', '4');
});

//Éditer Ouvrage
Route::get('/editer/ouvrage/(:num)', function($id){
	$ouvrage = Ouvrage::find($id);
	return View::make('edit.ouvrage')->with('ok', '4')->with('ouvrage', $ouvrage);
});

//Suprimer Ouvrage
Route::get('/delete/ouvrage/(:num)', function($id){
	$toDelete = Ouvrage::find($id);
	$toDelete->delete();
});

//Réponse Ajout Ouvrage
Route::post('/ajouter/ouvrage', function(){
	$save = '';
	if(array_get(Input::file('img0'), 'tmp_name')){
	    foreach(Input::file() as $img){
		$path = 'img';
		$filename = $img['name'];
		move_uploaded_file ($img['tmp_name'] , '/var/www/html/public/' . $path . '/' . $filename );
		$save .= $path . '/' . $filename . '~';
	    }
	}
	else{
		$save = 'img/default.png';
	}

	$newOuvrages = Ouvrage::create(array(
			'titre' => Input::get('titre'),
			'description' => Input::get('description'),
			'description_courte' => Input::get('description_courte'),
			'images' => $save,
			'annee_publication' => Input::get('annee_publication'),
			'fk_auteur' => Input::get('auteur'),
			'fk_type' => Input::get('type'),
			'fk_cat' => Input::get('categorie'),
			'mois_publication' => Input::get('mois_publication'),
			'nombre_pages' => Input::get('nb_page'),
			'fk_editeur' => Input::get('editeur'),
			'fk_imprimeur' => Input::get('imprimeur'),
			'nombre_editions' => Input::get('nb_edition'),
			'fk_local' => Input::get('localisation'),
			'notes' => Input::get('notes')
		));
	if($newOuvrages){
		return View::make('add.ouvrage')->with('ok', '1');
	}
	else{
		return View::make('add.ouvrage')->with('ok', '0');	
	}
});

//Réponse Ajout Ouvrage
Route::post('/editer/ouvrage/(:any)', function($edit){
	$ouvrage = Ouvrage::find($edit);
	$save = '';
	if(array_get(Input::file('img0'), 'tmp_name')){
	    foreach(Input::file() as $img){
		$path = 'img';
		$filename = $img['name'];
		move_uploaded_file ($img['tmp_name'] , '/var/www/html/public/' . $path . '/' . $filename );
		$save .= $path . '/' . $filename . '~';
	    }
	}
	else{
		$save = $ouvrage->images;
	}

	$ouvrage->titre = Input::get('titre');
	$ouvrage->description = Input::get('description');
	$ouvrage->description_courte = Input::get('description_courte');
	$ouvrage->images = $save;
	$ouvrage->annee_publication = Input::get('annee_publication');
	$ouvrage->fk_auteur = Input::get('auteur');
	$ouvrage->fk_type = Input::get('type');
	$ouvrage->fk_cat = Input::get('categorie');
	$ouvrage->mois_publication = Input::get('mois_publication');
	$ouvrage->nombre_pages = Input::get('nb_page');
	$ouvrage->fk_editeur = Input::get('editeur');
	$ouvrage->fk_imprimeur = Input::get('imprimeur');
	$ouvrage->nombre_editions = Input::get('nb_edition');
	$ouvrage->fk_local = Input::get('localisation');
	$ouvrage->notes = Input::get('notes');
	$ouvrage->save();

	return View::make('edit.ouvrage')->with('ok', '1')->with('ouvrage', $ouvrage);

});


/*
|--------------------------------------------------------------------------
| Routes de périodiques
|--------------------------------------------------------------------------
|
| Pour séparé la section périodiques
|
*/

//Ajouter Periodique
Route::get('/ajouter/periodique', function(){
	return View::make('add.periodique')->with('ok', '4');
});

//Éditer Periodique
Route::get('/editer/periodique/(:num)', function($id){
	$ouvrage = Periodique::find($id);
	return View::make('edit.periodique')->with('ok', '4')->with('ouvrage', $ouvrage);
});

//Réponse Ajout Periodique
Route::post('/ajouter/periodique', function(){
	$save = '';
	if(array_get(Input::file('img0'), 'tmp_name')){
	    foreach(Input::file() as $img){
		$path = 'img';
		$filename = $img['name'];
		move_uploaded_file ($img['tmp_name'] , '/var/www/html/public/' . $path . '/' . $filename );
		$save .= $path . '/' . $filename . '~';
	    }
	}
	else{
		$save = 'img/default.png';
	}

	$newOuvrages = Periodique::create(array(
			'titre' => Input::get('titre'),
			'description' => Input::get('description'),
			'description_courte' => Input::get('description_courte'),
			'images' => $save,
			'debut' => Input::get('debut'),
			'fk_frequence' => Input::get('frequence'),
			'fin' => Input::get('fin'),
			'fk_editeur' => Input::get('editeur'),
			'fk_imprimeur' => Input::get('imprimeur'),
			'proprietaire' => Input::get('proprietaire'),
			'notes' => Input::get('notes')
		));
	if($newOuvrages){
		return View::make('add.periodique')->with('ok', '1');
	}
	else{
		return View::make('add.periodique')->with('ok', '0');	
	}
});

//Réponse Ajout Ouvrage
Route::post('/editer/periodique/(:any)', function($edit){
	$ouvrage = Periodique::find($edit);
	$save = '';
	if(array_get(Input::file('img0'), 'tmp_name')){
	    foreach(Input::file() as $img){
		$path = 'img';
		$filename = $img['name'];
		move_uploaded_file ($img['tmp_name'] , '/var/www/html/public/' . $path . '/' . $filename );
		$save .= $path . '/' . $filename . '~';
	    }
	}
	else{
		$save = $ouvrage->images;
	}

	$ouvrage->titre = Input::get('titre');
	$ouvrage->description = Input::get('description');
	$ouvrage->description_courte = Input::get('description_courte');
	$ouvrage->images = $save;
	$ouvrage->debut = Input::get('debut');
	$ouvrage->fk_frequence = Input::get('frequence');
	$ouvrage->fin = Input::get('fin');
	$ouvrage->fk_editeur = Input::get('editeur');
	$ouvrage->fk_imprimeur = Input::get('imprimeur');
	$ouvrage->proprietaire = Input::get('proprietaire');
	$ouvrage->notes = Input::get('notes');
	$ouvrage->save();

	return View::make('edit.periodique')->with('ok', '1')->with('ouvrage', $ouvrage);
});

/*
|--------------------------------------------------------------------------
| Routes AJAX
|--------------------------------------------------------------------------
|
|	Ces routes sont donnent les réponsent pour les query AJAX du site
|
*/

//Retourne les données de la table Auteurs
Route::get('/ajax/loadchoices/auteur', function(){
	 return Response::eloquent(Auteur::order_by('nom', 'asc')->get());
});

//Retourne les données de la table Types
Route::get('/ajax/loadchoices/type', function(){
	 return Response::eloquent(Type::all());
});

//Retourne les données de la table Catégories
Route::get('/ajax/loadchoices/categorie', function(){
	 return Response::eloquent(Categorie::all());
});

//Retourne les données de la table Éditeurs
Route::get('/ajax/loadchoices/editeur', function(){
	 return Response::eloquent(Editeur::all());
});

//Retourne les données de la table Imprimeurs
Route::get('/ajax/loadchoices/imprimeur', function(){
	 return Response::eloquent(Imprimeur::all());
});

//Retourne les données de la table Localisations
Route::get('/ajax/loadchoices/localisation', function(){
	 return Response::eloquent(Localisation::all());
});

//Retourne les données de la table Frequences
Route::get('/ajax/loadchoices/frequence', function(){
	 return Response::eloquent(Frequence::all());
});


//Sauvegarde un nouvel Auteur et retourne un code
Route::get('/ajax/save/auteur', function(){
	$newAuteur = Auteur::create(array(
			'nom' => Input::get('aut_nom'),
			'prenom' => Input::get('aut_prenom'),
			'naissance' => Input::get('aut_date_naissance'),
			'deces' => Input::get('aut_date_deces'),
			'lien' => Input::get('aut_lien')
		));
	if($newAuteur){
		return '1';
	}
});

//Sauvegarde un nouvel Éditeur et retourne un code
Route::get('/ajax/save/editeur', function(){
	$newEditeur = Editeur::create(array(
			'nom' => Input::get('edit_nom'),
		));
	if($newEditeur){
		return '1';
	}
});

//Sauvegarde un nouvel Imprimeur et retourne un code
Route::get('/ajax/save/imprimeur', function(){
	$newImprimeur = Imprimeur::create(array(
			'nom' => Input::get('impr_nom'),
		));
	if($newImprimeur){
		return '1';
	}
});

//Sauvegarde une nouvelle Localisation et retourne un code
Route::get('/ajax/save/localisation', function(){
	$newLocalisation = Localisation::create(array(
			'nom' => Input::get('local_nom'),
		));
	if($newLocalisation){
		return '1';
	}
});

//Sauvegarde une nouvelle Fréquence et retourne un code
Route::get('/ajax/save/frequence', function(){
	$newLocalisation = Frequence::create(array(
			'nom' => Input::get('freq_nom'),
		));
	if($newLocalisation){
		return '1';
	}
});

/*
|--------------------------------------------------------------------------
| Application 404 & 500 Error Handlers
|--------------------------------------------------------------------------
|
| To centralize and simplify 404 handling, Laravel uses an awesome event
| system to retrieve the response. Feel free to modify this function to
| your tastes and the needs of your application.
|
| Similarly, we use an event to handle the display of 500 level errors
| within the application. These errors are fired when there is an
| uncaught exception thrown in the application.
|
*/

Event::listen('404', function()
{
	return Response::error('404');
});

Event::listen('500', function()
{
	return Response::error('500');
});

/*
|--------------------------------------------------------------------------
| Route Filters
|--------------------------------------------------------------------------
|
| Filters provide a convenient method for attaching functionality to your
| routes. The built-in before and after filters are called before and
| after every request to your application, and you may even create
| other filters that can be attached to individual routes.
|
| Let's walk through an example...
|
| First, define a filter:
|
|		Route::filter('filter', function()
|		{
|			return 'Filtered!';
|		});
|
| Next, attach the filter to a route:
|
|		Route::get('/', array('before' => 'filter', function()
|		{
|			return 'Hello World!';
|		}));
|
*/

Route::filter('before', function()
{
	// Do stuff before every request to your application...
});

Route::filter('after', function($response)
{
	// Do stuff after every request to your application...
});

Route::filter('csrf', function()
{
	if (Request::forged()) return Response::error('500');
});

Route::filter('auth', function()
{
	if (Auth::guest()) return Redirect::to('login');
});
