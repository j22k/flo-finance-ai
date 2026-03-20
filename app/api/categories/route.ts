import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import dbConnect from '@/lib/mongodb'
import Category from '@/models/Category'

export const GET = withAuth(async (request: NextRequest, { userId }) => {
    try {
        await dbConnect()

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // optional filter

        const query: any = { userId }
        if (type) {
            query.type = type
        }

        const categories = await Category.find(query).sort({ name: 1 })

        return NextResponse.json(categories)
    } catch (error) {
        console.error('Error fetching categories:', error)
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }
})

export const POST = withAuth(async (request: NextRequest, { userId }) => {
    try {
        const data = await request.json()

        if (!data.name || !data.type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        await dbConnect()

        // Check if category already exists for user
        const existingCategory = await Category.findOne({
            userId,
            name: { $regex: new RegExp(`^${data.name}$`, 'i') },
            type: data.type
        })

        if (existingCategory) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
        }

        const category = await Category.create({
            userId,
            name: data.name,
            type: data.type,
            color: data.color || '#cbd5e1'
        })

        return NextResponse.json(category, { status: 201 })
    } catch (error) {
        console.error('Error creating category:', error)
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }
})
