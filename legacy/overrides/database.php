<?php

// Mounted OVER application/config/database.php in the capsule (the v2 repo itself
// is read-only). Only the mysql host differs from the committed original.

return array(

	'profile' => false,

	'fetch' => PDO::FETCH_CLASS,

	'default' => 'mysql',

	'connections' => array(

		'sqlite' => array(
			'driver'   => 'sqlite',
			'database' => 'application',
			'prefix'   => '',
		),

		'mysql' => array(
			'driver'   => 'mysql',
			'host'     => 'db',
			'database' => 'eusebe',
			'username' => 'eusebe',
			'password' => 'Smj4UheAFUASB7nU',
			'charset'  => 'utf8',
			'prefix'   => '',
		),

	),

	'redis' => array(

		'default' => array(
			'host'     => '127.0.0.1',
			'port'     => 6379,
			'database' => 0,
		),

	),

);
