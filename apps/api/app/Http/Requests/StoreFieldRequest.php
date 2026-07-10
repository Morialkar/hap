<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreFieldRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', 'in:text,long_text,number,date,boolean,select,reference,image,file,url,email,title'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'options' => ['sometimes', 'array'],
            'validation' => ['sometimes', 'array'],
            'table_id' => ['required', 'uuid', 'exists:tables,id'],
            'is_filterable' => ['sometimes', 'boolean'],
        ];
    }
}
