<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;

uses(RefreshDatabase::class);

test('user can login with correct credentials', function () {
    $user = User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->postJson('/api/v1/login', [
        'email' => 'test@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'Logged in successfully',
        ])
        ->assertJsonPath('user.email', 'test@example.com');

    $this->assertTrue(Auth::check());
});

test('login rejects invalid credentials', function () {
    $user = User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->postJson('/api/v1/login', [
        'email' => 'test@example.com',
        'password' => 'wrongpassword',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    $this->assertFalse(Auth::check());
});

test('user can fetch authenticated user profile', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/user');

    $response->assertStatus(200)
        ->assertJsonPath('email', $user->email);
});

test('unauthenticated user cannot fetch profile', function () {
    $response = $this->getJson('/api/v1/user');

    $response->assertStatus(401);
});

test('user can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/logout');

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'Logged out successfully',
        ]);

    $this->assertFalse(Auth::check());
});
