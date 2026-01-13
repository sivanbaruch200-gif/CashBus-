/**
 * API Route: Create Stripe Invoice for Commission Payment
 *
 * Creates a Stripe invoice for the 15% success fee
 */

import { NextRequest, NextResponse } from 'next/server'

// TODO: Install Stripe: npm install stripe
// import Stripe from 'stripe'
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16',
// })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, claimId, amount, currency, description } = body

    // Validate required fields
    if (!userId || !claimId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, claimId, amount' },
        { status: 400 }
      )
    }

    // Get user details from database
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('full_name, email, phone')
    //   .eq('id', userId)
    //   .single()

    // if (!profile) {
    //   return NextResponse.json({ error: 'User not found' }, { status: 404 })
    // }

    // TODO: Uncomment when Stripe is installed
    /*
    // 1. Create or get Stripe customer
    let customer
    const existingCustomers = await stripe.customers.list({
      email: profile.email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: profile.email,
        name: profile.full_name,
        phone: profile.phone,
        metadata: {
          user_id: userId,
        },
      })
    }

    // 2. Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 14, // 14 days to pay
      currency: currency || 'ils',
      description: description || `עמלת הצלחה - תביעה ${claimId.slice(0, 8)}`,
      metadata: {
        claim_id: claimId,
        user_id: userId,
        payment_type: 'commission',
      },
    })

    // 3. Create invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Convert to agorot (cents)
      currency: currency || 'ils',
      description: description || 'עמלת הצלחה (15%)',
    })

    // 4. Finalize invoice (makes it payable)
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)

    // 5. Return invoice URL
    return NextResponse.json({
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      amount: amount,
      currency: currency || 'ILS',
    })
    */

    // TEMPORARY: Mock response for development
    console.log('📄 MOCK STRIPE INVOICE CREATED')
    console.log('User ID:', userId)
    console.log('Claim ID:', claimId)
    console.log('Amount:', amount, currency || 'ILS')
    console.log('Description:', description)

    return NextResponse.json({
      success: true,
      invoiceId: `inv_mock_${Date.now()}`,
      invoiceUrl: `https://invoice.stripe.com/mock/${claimId}`,
      invoicePdf: `https://invoice.stripe.com/mock/${claimId}/pdf`,
      amount: amount,
      currency: currency || 'ILS',
      mock: true,
      note: 'Install Stripe to enable real invoicing: npm install stripe',
    })
  } catch (error) {
    console.error('Error creating Stripe invoice:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create invoice',
      },
      { status: 500 }
    )
  }
}

/**
 * Configuration for API route
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
