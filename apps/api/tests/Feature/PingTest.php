<?php

it('returns ok on the ping endpoint', function () {
    $response = $this->getJson('/api/v1/ping');

    $response->assertOk()
        ->assertJson([
            'status' => 'ok',
            'version' => '1',
        ]);
});
