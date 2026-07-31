<?php

use App\Models\Database;
use App\Models\Field;
use App\Models\Record;
use App\Models\RecordLink;
use App\Models\Table;
use App\Models\Workspace;
use App\Services\ReportQueryService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function setupTestData()
{
    $workspace = Workspace::factory()->create();
    $database = Database::factory()->create(['workspace_id' => $workspace->id]);
    $authorsTable = Table::factory()->create([
        'database_id' => $database->id,
        'name' => 'authors',
    ]);
    $booksTable = Table::factory()->create([
        'database_id' => $database->id,
        'name' => 'books',
    ]);

    $authorNameField = Field::factory()->create([
        'table_id' => $authorsTable->id,
        'name' => 'name',
        'type' => 'text',
    ]);
    $authorBirthField = Field::factory()->create([
        'table_id' => $authorsTable->id,
        'name' => 'birth_year',
        'type' => 'number',
    ]);

    $bookTitleField = Field::factory()->create([
        'table_id' => $booksTable->id,
        'name' => 'title',
        'type' => 'text',
    ]);
    $bookPriceField = Field::factory()->create([
        'table_id' => $booksTable->id,
        'name' => 'price',
        'type' => 'number',
    ]);
    $bookGenreField = Field::factory()->create([
        'table_id' => $booksTable->id,
        'name' => 'genre',
        'type' => 'text',
    ]);
    $bookAuthorField = Field::factory()->create([
        'table_id' => $booksTable->id,
        'name' => 'author',
        'type' => 'reference',
        'options' => ['multi' => false, 'target_table' => $authorsTable->id],
    ]);
    $bookCoAuthorsField = Field::factory()->create([
        'table_id' => $booksTable->id,
        'name' => 'co_authors',
        'type' => 'reference',
        'options' => ['multi' => true, 'target_table' => $authorsTable->id],
    ]);

    // Create Authors
    $rowling = Record::factory()->create([
        'table_id' => $authorsTable->id,
        'data' => ['name' => 'J.K. Rowling', 'birth_year' => 1965],
    ]);
    $tolkien = Record::factory()->create([
        'table_id' => $authorsTable->id,
        'data' => ['name' => 'J.R.R. Tolkien', 'birth_year' => 1892],
    ]);
    $sanderson = Record::factory()->create([
        'table_id' => $authorsTable->id,
        'data' => ['name' => 'Brandon Sanderson', 'birth_year' => 1975],
    ]);

    // Create Books
    $hp1 = Record::factory()->create([
        'table_id' => $booksTable->id,
        'data' => [
            'title' => 'Harry Potter 1',
            'price' => 15,
            'genre' => 'Fantasy',
            'author' => $rowling->id,
            'co_authors' => [],
        ],
    ]);
    $lotr = Record::factory()->create([
        'table_id' => $booksTable->id,
        'data' => [
            'title' => 'Lord of the Rings',
            'price' => 25,
            'genre' => 'Fantasy',
            'author' => $tolkien->id,
            'co_authors' => [$sanderson->id],
        ],
    ]);
    $twok = Record::factory()->create([
        'table_id' => $booksTable->id,
        'data' => [
            'title' => 'The Way of Kings',
            'price' => 30,
            'genre' => 'Fantasy',
            'author' => $sanderson->id,
            'co_authors' => [$rowling->id, $tolkien->id],
        ],
    ]);
    $nonfiction1 = Record::factory()->create([
        'table_id' => $booksTable->id,
        'data' => [
            'title' => 'Some History Book',
            'price' => 45,
            'genre' => 'History',
            'author' => null,
            'co_authors' => [],
        ],
    ]);

    // Create Record Links
    RecordLink::create([
        'from_record' => $hp1->id,
        'field_id' => $bookAuthorField->id,
        'to_record' => $rowling->id,
    ]);

    RecordLink::create([
        'from_record' => $lotr->id,
        'field_id' => $bookAuthorField->id,
        'to_record' => $tolkien->id,
    ]);
    RecordLink::create([
        'from_record' => $lotr->id,
        'field_id' => $bookCoAuthorsField->id,
        'to_record' => $sanderson->id,
    ]);

    RecordLink::create([
        'from_record' => $twok->id,
        'field_id' => $bookAuthorField->id,
        'to_record' => $sanderson->id,
    ]);
    RecordLink::create([
        'from_record' => $twok->id,
        'field_id' => $bookCoAuthorsField->id,
        'to_record' => $rowling->id,
    ]);
    RecordLink::create([
        'from_record' => $twok->id,
        'field_id' => $bookCoAuthorsField->id,
        'to_record' => $tolkien->id,
    ]);

    return [
        'booksTable' => $booksTable,
        'hp1' => $hp1,
        'lotr' => $lotr,
        'twok' => $twok,
        'nonfiction1' => $nonfiction1,
        'rowling' => $rowling,
        'tolkien' => $tolkien,
        'sanderson' => $sanderson,
    ];
}

test('resolves scalar and reference projections correctly', function () {
    $data = setupTestData();
    $service = new ReportQueryService;

    $ast = [
        'select' => ['title', 'price', 'author.name', 'author.birth_year', 'author.id', 'co_authors.name'],
    ];

    $result = $service->execute($data['booksTable'], $ast);

    expect($result['columns'])->toBe($ast['select']);

    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);

    // Check HP1 projection
    $hp1Row = $records->firstWhere('id', $data['hp1']->id);
    expect($hp1Row['title'])->toBe('Harry Potter 1');
    expect($hp1Row['price'])->toBe(15);
    expect($hp1Row['author.name'])->toBe('J.K. Rowling');
    expect($hp1Row['author.birth_year'])->toBe(1965);
    expect($hp1Row['author.id'])->toBe($data['rowling']->id);
    expect($hp1Row['co_authors.name'])->toBeEmpty();

    // Check LOTR projection
    $lotrRow = $records->firstWhere('id', $data['lotr']->id);
    expect($lotrRow['title'])->toBe('Lord of the Rings');
    expect($lotrRow['author.name'])->toBe('J.R.R. Tolkien');
    expect($lotrRow['co_authors.name'])->toBe(['Brandon Sanderson']);

    // Check TWOK projection
    $twokRow = $records->firstWhere('id', $data['twok']->id);
    expect($twokRow['title'])->toBe('The Way of Kings');
    expect($twokRow['author.name'])->toBe('Brandon Sanderson');
    // co_authors.name contains Rowling and Tolkien (order can depend but both should be there)
    expect($twokRow['co_authors.name'])->toContain('J.K. Rowling');
    expect($twokRow['co_authors.name'])->toContain('J.R.R. Tolkien');

    // Check Null Author book projection
    $nfRow = $records->firstWhere('id', $data['nonfiction1']->id);
    expect($nfRow['author.name'])->toBeNull();
    expect($nfRow['co_authors.name'])->toBeEmpty();
});

test('applies scalar filter operators correctly', function () {
    $data = setupTestData();
    $service = new ReportQueryService;

    // Test 'gt' operator
    $ast = [
        'select' => ['title', 'price'],
        'where' => [
            'logic' => 'and',
            'conditions' => [
                ['field' => 'price', 'operator' => 'gt', 'value' => 20],
            ],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    expect($records)->toHaveCount(3); // LOTR (25), TWOK (30), NonFiction (45)
    expect($records->pluck('title'))->not->toContain('Harry Potter 1');

    // Test 'eq' and nested 'or' operator
    $ast = [
        'select' => ['title'],
        'where' => [
            'logic' => 'or',
            'conditions' => [
                ['field' => 'title', 'operator' => 'eq', 'value' => 'Harry Potter 1'],
                ['field' => 'price', 'operator' => 'gte', 'value' => 40],
            ],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    expect($records)->toHaveCount(2); // HP1, NonFiction
    expect($records->pluck('title'))->toContain('Harry Potter 1');
    expect($records->pluck('title'))->toContain('Some History Book');

    // Test 'contains' and 'neq'
    $ast = [
        'select' => ['title'],
        'where' => [
            'logic' => 'and',
            'conditions' => [
                ['field' => 'title', 'operator' => 'contains', 'value' => 'King'],
                ['field' => 'price', 'operator' => 'neq', 'value' => 10],
            ],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    expect($records)->toHaveCount(1);
    expect($records->first()['title'])->toBe('The Way of Kings');

    // Test 'is_null'
    $ast = [
        'select' => ['title'],
        'where' => [
            'logic' => 'and',
            'conditions' => [
                ['field' => 'author', 'operator' => 'is_null', 'value' => null],
            ],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    expect($records)->toHaveCount(1);
    expect($records->first()['title'])->toBe('Some History Book');
});

test('applies reference filters correctly', function () {
    $data = setupTestData();
    $service = new ReportQueryService;

    // Filter books where author.name is Brandon Sanderson
    $ast = [
        'select' => ['title', 'author.name'],
        'where' => [
            'logic' => 'and',
            'conditions' => [
                ['field' => 'author.name', 'operator' => 'eq', 'value' => 'Brandon Sanderson'],
            ],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    expect($records)->toHaveCount(1);
    expect($records->first()['title'])->toBe('The Way of Kings');
});

test('applies sorting correctly', function () {
    $data = setupTestData();
    $service = new ReportQueryService;

    // Sort by price desc
    $ast = [
        'select' => ['title', 'price'],
        'sort' => [
            ['field' => 'price', 'direction' => 'desc'],
        ],
    ];

    $result = $service->execute($data['booksTable'], $ast);
    $records = collect($result['groups'])->flatMap(fn ($group) => $group['records']);
    $titles = $records->pluck('title')->toArray();

    expect($titles)->toBe([
        'Some History Book',  // 45
        'The Way of Kings',   // 30
        'Lord of the Rings',  // 25
        'Harry Potter 1',     // 15
    ]);
});

test('applies grouping correctly', function () {
    $data = setupTestData();
    $service = new ReportQueryService;

    // Group by genre (scalar)
    $ast = [
        'select' => ['title', 'genre'],
        'group_by' => 'genre',
    ];

    $result = $service->execute($data['booksTable'], $ast);

    expect($result['groups'])->toHaveCount(2); // Fantasy, History

    $fantasyGroup = collect($result['groups'])->firstWhere('key', 'Fantasy');
    $historyGroup = collect($result['groups'])->firstWhere('key', 'History');

    expect($fantasyGroup)->not->toBeNull();
    expect($historyGroup)->not->toBeNull();
    expect($fantasyGroup['records'])->toHaveCount(3);
    expect($historyGroup['records'])->toHaveCount(1);

    // Group by author.name (reference traversal)
    $ast2 = [
        'select' => ['title', 'author.name'],
        'group_by' => 'author.name',
    ];

    $result2 = $service->execute($data['booksTable'], $ast2);
    // Groups should be: J.K. Rowling, J.R.R. Tolkien, Brandon Sanderson, Inconnu
    expect($result2['groups'])->toHaveCount(4);

    $rowlingGroup = collect($result2['groups'])->firstWhere('key', 'J.K. Rowling');
    $inconnuGroup = collect($result2['groups'])->firstWhere('key', 'Inconnu');

    expect($rowlingGroup)->not->toBeNull();
    expect($inconnuGroup)->not->toBeNull();
    expect($rowlingGroup['records'][0]['title'])->toBe('Harry Potter 1');
    expect($inconnuGroup['records'][0]['title'])->toBe('Some History Book');
});
