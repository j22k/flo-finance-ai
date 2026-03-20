import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import dbConnect from '@/lib/mongodb'
import Category from '@/models/Category'

export const PUT = withAuth(async (
    request: NextRequest,
    { params, userId }: { params: { id: string }, userId: string }
) => {
    try {
        await dbConnect()

        const data = await request.json()

        // Check if updating to a name that already exists
        if (data.name) {
             const existingCategory = await Category.findOne({
                userId,
                name: { $regex: new RegExp(`^${data.name}$`, 'i') },
                type: data.type,
                _id: { $ne: params.id }
            })

            if (existingCategory) {
                 return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
            }
        }

        const category = await Category.findOneAndUpdate(
            { _id: params.id, userId },
            { $set: data },
            { new: true, runValidators: true }
        )

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        }

        return NextResponse.json(category)
    } catch (error) {
        console.error('Error updating category:', error)
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }
})

export const DELETE = withAuth(async (
    request: NextRequest,
    { params, userId }: { params: { id: string }, userId: string }
) => {
    try {
        await dbConnect()

        const category = await Category.findOneAndDelete({
            _id: params.id,
            userId,
        })

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Category deleted' })
    } catch (error) {
        console.error('Error deleting category:', error)
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }
})
