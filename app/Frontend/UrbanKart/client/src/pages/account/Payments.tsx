import { AccountLayout } from "@/components/account/AccountLayout";
import { useSavedCards, useDeleteSavedCard } from "@/hooks/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, Trash2, Loader2, Shield } from "lucide-react";
import { useState } from "react";

const CARD_BRANDS: Record<string, { color: string; label: string }> = {
  visa: { color: "bg-blue-100 text-blue-800", label: "Visa" },
  mastercard: { color: "bg-orange-100 text-orange-800", label: "Mastercard" },
  amex: { color: "bg-indigo-100 text-indigo-800", label: "Amex" },
  discover: { color: "bg-amber-100 text-amber-800", label: "Discover" },
};

export default function Payments() {
  const { data: cards, isLoading } = useSavedCards();
  const deleteCard = useDeleteSavedCard();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteCard.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Saved Cards</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your saved payment methods.</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <Shield className="w-4 h-4 shrink-0" />
          <span>Your card details are securely encrypted and stored by our payment provider.</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !cards ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">Unable to load payment methods. Please try again later.</p>
            </CardContent>
          </Card>
        ) : !cards.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No saved cards</h3>
              <p className="text-muted-foreground text-sm">Cards added during checkout will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => {
              const brand = CARD_BRANDS[card.cardType.toLowerCase()] || { color: "bg-gray-100 text-gray-800", label: card.cardType };
              return (
                <Card key={card.id} className={card.isDefault ? "border-primary/50" : ""} data-testid={`card-payment-${card.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-gradient-to-br from-gray-800 to-gray-600 rounded-md flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`text-[10px] ${brand.color}`}>
                              {brand.label}
                            </Badge>
                            {card.isDefault && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-sm font-semibold mt-1">
                            **** **** **** {card.last4}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <p>{card.holderName}</p>
                        <p className="text-xs">
                          Expires {String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(card.id)}
                        data-testid={`button-delete-card-${card.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this saved card?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteCard.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountLayout>
  );
}
