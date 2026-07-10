<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create the test user
        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        // Create a default workspace for local development
        $workspace = new Workspace;
        $workspace->id = (string) Str::uuid();
        $workspace->name = 'Mon espace de travail';
        $workspace->save();

        // Add the test user as the owner of this workspace
        $member = new WorkspaceMember;
        $member->id = (string) Str::uuid();
        $member->workspace_id = $workspace->id;
        $member->user_id = $user->id;
        $member->role = 'owner';
        $member->save();

        // Call the template seeder
        $this->call(TemplateSeeder::class);
    }
}
